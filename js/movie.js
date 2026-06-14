import { state } from './state.js';
import {
  escapeHtml, safeStatus, getSceneOverallStatus, getNowFormattedString, syncItemStatuses
} from './utils.js';
import { updateMovie } from './firebase.js';
import { goScene } from './nav.js';
import { collectDatesFromContainer, collectItemsFromDOM, addDateInput, updateSelectColor, checkSceneInput, collectCharactersFromDOM, renderCharacterCheckboxes } from './items.js';
import { showToast } from './toast.js';
import { celebrate } from './celebrate.js';

export function setViewMode(mode) {
  state.currentViewMode = mode;
  ['list', 'cos', 'prop'].forEach((id) => {
    document.getElementById('btn-view-' + id).classList.remove('active');
  });
  document.getElementById('btn-view-' + mode).classList.add('active');

  const sortSel = document.getElementById('sort-select');
  sortSel.innerHTML = '';
  if (mode === 'list') {
    sortSel.add(new Option('番号順 (昇順)', 'num-asc'));
    sortSel.add(new Option('番号順 (降順)', 'num-desc'));
    sortSel.add(new Option('撮影日が早い順', 'date-asc'));
    sortSel.add(new Option('撮影日が遅い順', 'date-desc'));
    state.currentSort = 'num-asc';
    sortSel.value = 'num-asc';
  } else {
    sortSel.add(new Option('使用シーンが多い順', 'count-desc'));
    sortSel.add(new Option('名前順', 'name-asc'));
    sortSel.add(new Option('最速使用日が早い順', 'date-asc'));
    state.currentSort = 'count-desc';
    sortSel.value = 'count-desc';
  }

  renderMovie();
}

export function updateSort(val) {
  state.currentSort = val;
  renderMovie();
}

export function renderMovie() {
  state.renderedMovieId = state.currentMovieId;
  const scrollY = window.scrollY;
  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  const list = document.getElementById('scene-list');

  list.style.minHeight = list.offsetHeight + 'px';
  list.innerHTML = '';

  if (!movie || movie.scenes.length === 0) {
    list.innerHTML = '<p class="scene-info">まだシーンがありません。</p>';
    list.style.minHeight = '';
    return;
  }

  if (state.currentViewMode === 'cos') {
    renderInventory(movie, list, 'costumes');
  } else if (state.currentViewMode === 'prop') {
    renderInventory(movie, list, 'props');
  } else {
    const displayScenes = [...movie.scenes];

    displayScenes.sort((a, b) => {
      if (state.currentSort === 'num-asc') return String(a.number).localeCompare(String(b.number), undefined, { numeric: true, sensitivity: 'base' });
      if (state.currentSort === 'num-desc') return String(b.number).localeCompare(String(a.number), undefined, { numeric: true, sensitivity: 'base' });
      if (state.currentSort === 'date-asc' || state.currentSort === 'date-desc') {
        const dateA = (a.dates && a.dates.length > 0) ? [...a.dates].sort()[0] : null;
        const dateB = (b.dates && b.dates.length > 0) ? [...b.dates].sort()[0] : null;
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return state.currentSort === 'date-asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      }
      return 0;
    });

    displayScenes.forEach((scene) => list.appendChild(createSceneCard(scene)));
  }

  setTimeout(() => {
    list.style.minHeight = '';
    window.scrollTo(0, scrollY);
  }, 0);
}

export function createSceneCard(scene, forceMovieId = null) {
  const div = document.createElement('div');
  div.className = 'card';
  if (scene.id === state.currentSceneId) div.style.border = '2px solid var(--accent-color)';
  if (state.selectedSceneIds.has(scene.id)) div.classList.add('selected-card');

  let borderStatus = getSceneOverallStatus(scene);
  if (scene.status === '撮影済み') borderStatus = 'used';
  div.classList.add(`scene-border-${borderStatus}`);

  const isShot = scene.status === '撮影済み';

  let html = `<div class="scene-card-header" style="flex-direction: column; align-items: stretch;">`;

  html += `
    <div class="editor-only" style="display:flex; align-items:center; gap:8px; margin-bottom:4px; width:100%;">
      ${!forceMovieId ? `<input type="checkbox" class="scene-checkbox" ${state.selectedSceneIds.has(scene.id) ? 'checked' : ''}>` : ''}
      <label class="switch-container shot-switch" style="margin-left:auto; margin-bottom:0;">
        <span class="switch-label" style="font-size:11px; min-width:auto;">${isShot ? '撮影済み' : '未撮影'}</span>
        <div class="switch" style="width:36px; height:20px;">
          <input type="checkbox" class="shot-toggle" ${isShot ? 'checked' : ''}>
          <span class="slider"></span>
        </div>
      </label>
    </div>
  `;

  html += `
    <div class="viewer-only" style="width:100%; text-align:right; margin-bottom:4px;">
      <span class="status-color ${isShot ? 'status-使用済み' : 'status-未着手'}" style="font-size:11px; padding:1px 6px; border-radius: 4px; display:inline-block; border: 1px solid;">
        ${isShot ? '撮影済み' : '未撮影'}
      </span>
    </div>
  `;

  html += `<div class="scene-content" style="width:100%;">`;

  html += `<div style="display:flex; justify-content:space-between; align-items:center;">
    <strong>シーン ${escapeHtml(scene.number)}</strong>
    <span class="time-zone-badge">${escapeHtml(scene.timeZone || '-')}</span>
  </div>`;

  if (scene.sceneName) html += ` ｜ ${escapeHtml(scene.sceneName)}`;
  if (scene.location) html += ` ｜ ${escapeHtml(scene.location)}`;

  const dateText = (scene.dates && scene.dates.length > 0) ? scene.dates.join(', ') : '未定';
  html += `<div class="scene-info">撮影日: ${escapeHtml(dateText)}</div>`;

  if (scene.updatedAt) {
    html += `<div class="scene-info" style="font-size:10px; color:var(--muted-text);">最終更新: ${escapeHtml(scene.updatedAt)}</div>`;
  }

  if (scene.characters && scene.characters.length > 0) {
    html += `<div style="margin-top: 8px;">`;
    scene.characters.forEach((c) => { html += `<span class="character-badge">${escapeHtml(c)}</span>`; });
    html += `</div>`;
  }

  html += `<div style="margin-top: 8px;">`;
  if (scene.costumes && scene.costumes.length > 0) {
    scene.costumes.forEach((c) => { html += `<span class="item-badge status-${safeStatus(c.status)}">${escapeHtml(c.name)}</span>`; });
    html += `<br>`;
  }
  if (scene.props && scene.props.length > 0) {
    scene.props.forEach((p) => { html += `<span class="item-badge status-${safeStatus(p.status)}">${escapeHtml(p.name)}</span>`; });
  }
  html += `</div></div></div>`;

  div.innerHTML = html;

  div.addEventListener('click', () => goScene(scene.id, forceMovieId));

  const checkbox = div.querySelector('.scene-checkbox');
  if (checkbox) {
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSceneSelection(scene.id, checkbox);
    });
  }

  const shotSwitch = div.querySelector('.shot-switch');
  if (shotSwitch) {
    shotSwitch.addEventListener('click', (e) => e.stopPropagation());
    div.querySelector('.shot-toggle').addEventListener('change', (e) => {
      toggleSceneShotStatus(scene.id, e.target, forceMovieId);
    });
  }

  return div;
}

export function toggleSceneSelection(sceneId, checkbox) {
  if (checkbox.checked) state.selectedSceneIds.add(sceneId);
  else state.selectedSceneIds.delete(sceneId);

  const btn = document.getElementById('bulk-delete-btn');
  if (state.selectedSceneIds.size > 0 && state.isEditorMode) btn.classList.remove('hidden');
  else btn.classList.add('hidden');

  const card = checkbox.closest('.card');
  if (checkbox.checked) card.classList.add('selected-card');
  else card.classList.remove('selected-card');
}

export async function deleteSelectedScenes() {
  if (!confirm(`${state.selectedSceneIds.size}件のシーンを削除しますか？`)) return;
  const ids = new Set(state.selectedSceneIds);
  state.selectedSceneIds.clear();
  document.getElementById('bulk-delete-btn').classList.add('hidden');
  await updateMovie(state.currentMovieId, (data) => {
    data.scenes = data.scenes.filter((s) => !ids.has(s.id));
  });
}

export async function toggleSceneShotStatus(sceneId, checkbox, forceMovieId) {
  const movieId = forceMovieId ?? state.currentMovieId;
  const newStatus = checkbox.checked ? '撮影済み' : '未撮影';
  const now = getNowFormattedString();

  const localMovie = state.movies.find((m) => m.id === movieId);
  const localScene = localMovie?.scenes.find((s) => s.id === sceneId);
  const prevStatus = localScene?.status;
  const prevUpdatedAt = localScene?.updatedAt;
  if (localScene) { localScene.status = newStatus; localScene.updatedAt = now; }

  checkbox.disabled = true;
  try {
    await updateMovie(movieId, (data) => {
      const scene = data.scenes.find((s) => s.id === sceneId);
      if (!scene) return false;
      scene.status = newStatus;
      scene.updatedAt = now;
    });
    if (newStatus === '撮影済み') {
      const allShot = localMovie && localMovie.scenes.length > 0 && localMovie.scenes.every((s) => s.status === '撮影済み');
      if (allShot) celebrate('🎉 全シーン撮影完了！おつかれさま！', true);
    }
  } catch (e) {

    checkbox.checked = !checkbox.checked;
    if (localScene) { localScene.status = prevStatus; localScene.updatedAt = prevUpdatedAt; }
  } finally {
    checkbox.disabled = false;
  }
}

export async function addScene() {
  const num = document.getElementById('new-scene-number').value.trim();
  const name = document.getElementById('new-scene-name').value.trim();
  const loc = document.getElementById('new-scene-location').value.trim();
  const timeZone = document.getElementById('new-scene-time-zone').value;
  const memo = document.getElementById('new-scene-memo').value.trim();
  const dates = collectDatesFromContainer('new-scene-dates');
  const characters = collectCharactersFromDOM('new-scene-characters');

  const newCostumes = collectItemsFromDOM('new-costume-list');
  const newProps = collectItemsFromDOM('new-prop-list');

  const newScene = {
    id: Date.now(), number: num, sceneName: name, location: loc, memo: memo, dates: dates,
    timeZone: timeZone, status: '未撮影', characters: characters, costumes: newCostumes, props: newProps,
    updatedAt: getNowFormattedString()
  };

  await updateMovie(state.currentMovieId, (data) => {
    data.scenes.push(newScene);
    syncItemStatuses(data, newCostumes, 'costumes');
    syncItemStatuses(data, newProps, 'props');
  });

  document.getElementById('new-scene-number').value = '';
  document.getElementById('new-scene-name').value = '';
  document.getElementById('new-scene-location').value = '';
  document.getElementById('new-scene-time-zone').value = '';
  document.getElementById('new-scene-memo').value = '';
  document.getElementById('new-scene-dates').innerHTML = '';
  addDateInput('new-scene-dates');
  renderCharacterCheckboxes('new-scene-characters', []);
  document.getElementById('new-costume-list').innerHTML = '';
  document.getElementById('new-prop-list').innerHTML = '';
  document.getElementById('new-scene-details').removeAttribute('open');
  checkSceneInput();
  showToast(`シーン ${num} を追加しました`);
}

export function getUniqueItemNames(movie, typeKey) {
  const names = new Set();
  movie.scenes.forEach((s) => {
    const items = (typeKey === 'costumes' ? s.costumes : s.props) || [];
    items.forEach((item) => names.add(item.name));
  });
  return Array.from(names).sort();
}

export function getUniqueCharacterNames(movie) {
  const names = new Set();
  movie.scenes.forEach((s) => (s.characters || []).forEach((c) => names.add(c)));
  return Array.from(names).sort();
}

const GSEP = '␟';
const matchGroup = (character, name) => (i) => i.name === name && (i.character || '') === character;

function getEarliestDate(movie, typeKey, character, name) {
  const scenes = movie.scenes.filter((s) => {
    const items = (typeKey === 'costumes' ? s.costumes : s.props) || [];
    return items.some(matchGroup(character, name)) && s.dates && s.dates.length > 0;
  });
  if (scenes.length === 0) return null;
  const allDates = scenes.flatMap((s) => s.dates).sort();
  return allDates[0];
}

function getItemStatuses(movie, typeKey, character, name) {
  const statuses = new Set();
  movie.scenes.forEach((s) => {
    const items = (typeKey === 'costumes' ? s.costumes : s.props) || [];
    items.filter(matchGroup(character, name)).forEach((i) => statuses.add(i.status));
  });
  return statuses;
}

function getUniqueGroups(movie, typeKey) {
  const map = new Map();
  movie.scenes.forEach((s) => {
    ((typeKey === 'costumes' ? s.costumes : s.props) || []).forEach((it) => {
      const character = it.character || '';
      const key = character + GSEP + it.name;
      if (!map.has(key)) map.set(key, { character, name: it.name });
    });
  });
  return Array.from(map.values());
}

function partsHtml(parts) {
  if (!parts || !parts.length) return '';
  const chips = parts.map((p) => {
    const st = safeStatus(p.status);
    return `<span class="part-chip" title="${escapeHtml(p.desc || '')}"><span class="status-color status-${st} part-stat">${escapeHtml(st)}</span>${escapeHtml(p.name)}</span>`;
  }).join('');
  return `<div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center; margin-top:4px;"><span style="color:var(--muted-text); font-size:12px;">構成:</span>${chips}</div>`;
}

export function renderInventory(movie, listContainer, typeKey) {
  const groups = getUniqueGroups(movie, typeKey);
  const typeLabel = typeKey === 'costumes' ? '衣装' : '小道具';
  const whoLabel = typeKey === 'costumes' ? '誰の衣装' : '誰の小道具';

  if (groups.length === 0) {
    listContainer.innerHTML = `<p class="scene-info">まだ登録されていません。</p>`;
    return;
  }

  const readyCount = groups.filter((g) => {
    const statuses = getItemStatuses(movie, typeKey, g.character, g.name);
    return statuses.size === 1 && statuses.has('準備完了');
  }).length;
  const ratePct = Math.round((readyCount / groups.length) * 100);

  const rateCard = document.createElement('div');
  rateCard.className = 'card card-no-click';
  rateCard.innerHTML = `
    <div class="rate-summary">
      <span>${typeLabel}の準備達成率</span>
      <span style="font-size: 20px;">${ratePct}%</span>
    </div>
    <div class="scene-info" style="margin-top: 2px;">準備完了: ${readyCount} / ${groups.length}個</div>
    <div class="progress-track">
      <div class="progress-fill" style="width: ${ratePct}%;"></div>
    </div>
  `;
  listContainer.appendChild(rateCard);

  groups.sort((a, b) => {
    if (state.currentSort === 'name-asc') return (a.name + a.character).localeCompare(b.name + b.character);
    if (state.currentSort === 'date-asc') {
      const dateA = getEarliestDate(movie, typeKey, a.character, a.name);
      const dateB = getEarliestDate(movie, typeKey, b.character, b.name);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.localeCompare(dateB);
    }
    if (state.currentSort === 'count-desc') {
      const cnt = (g) => movie.scenes.filter((s) => ((typeKey === 'costumes' ? s.costumes : s.props) || []).some(matchGroup(g.character, g.name))).length;
      return cnt(b) - cnt(a);
    }
    return 0;
  });

  groups.forEach((group) => {
    const character = group.character;
    const name = group.name;
    const gkey = character + GSEP + name;
    const match = matchGroup(character, name);

    const matchingScenes = movie.scenes.filter((s) => ((typeKey === 'costumes' ? s.costumes : s.props) || []).some(match));
    const sampleItem = matchingScenes[0][typeKey].find(match) || {};

    const itemStatuses = getItemStatuses(movie, typeKey, character, name);
    let statusHtml = '';
    if (itemStatuses.size === 1) {
      const stx = safeStatus(Array.from(itemStatuses)[0]);
      statusHtml = `<span class="inventory-status-badge status-color status-${stx}">${escapeHtml(stx)}</span>`;
    }

    let earliestHtml = '';
    if (state.currentSort === 'date-asc') {
      const earliest = getEarliestDate(movie, typeKey, character, name);
      earliestHtml = `<div class="earliest-date-label">最速使用日: ${escapeHtml(earliest || '未定')}</div>`;
    }

    const charBadge = character ? `<span class="character-badge" style="margin-left:6px;">${escapeHtml(character)}</span>` : '';

    const details = document.createElement('details');
    details.className = 'accordion inventory-accordion';
    if (state.openedAccordionNames.has(gkey)) details.setAttribute('open', 'true');
    details.addEventListener('toggle', () => {
      if (details.hasAttribute('open')) state.openedAccordionNames.add(gkey);
      else state.openedAccordionNames.delete(gkey);
    });

    const summary = document.createElement('summary');
    summary.innerHTML = `
      <div style="display:flex; align-items:flex-start; width:100%;">
        <div style="flex-shrink:0; margin-top:2px;">${statusHtml}</div>
        <div style="flex:1; word-break:break-all; line-height:1.4;">${escapeHtml(name)}${charBadge}${earliestHtml}</div>
        <div style="flex-shrink:0; white-space:nowrap; margin-left:8px; font-weight:normal; font-size:12px; color:var(--muted-text);">(${matchingScenes.length}件)</div>
      </div>
    `;
    details.appendChild(summary);

    const content = document.createElement('div');
    content.className = 'accordion-content';

    const editArea = document.createElement('div');
    editArea.className = 'editor-only';
    editArea.style.cssText = 'background:var(--card-bg); padding:12px; margin-bottom:12px; border:1px solid var(--border-color); font-size:13px;';

    const st = safeStatus(sampleItem.status || '未着手');

    editArea.innerHTML = `
      <div style="margin-bottom:8px;">
        <strong style="color:var(--accent-color);">[一括管理マネージャー]</strong>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:8px;">
        <span>ステータス:</span>
        <select class="item-status status-color status-${st} inv-status" style="width:auto; margin:0; padding:4px 8px;">
          <option value="未着手">未着手</option>
          <option value="準備中">準備中</option>
          <option value="準備完了">準備完了</option>
        </select>
        <button class="secondary inv-rename" style="width:auto; margin:0; padding:4px 8px; font-size:12px; background:var(--text-color); color:var(--bg-color);">✏️ 名称を一斉変更</button>
      </div>
      <div style="margin-bottom:4px;">${whoLabel}:</div>
      <select class="inv-character" style="width:auto; margin:0 0 8px; padding:4px 8px; font-size:12px;"></select>
      <div style="margin-bottom:4px;">構成パーツ（名称・詳細・準備状況）:</div>
      <div class="inv-parts"></div>
      <button type="button" class="inv-add-part" style="width:auto; margin:4px 0 8px; padding:4px 10px; font-size:12px; background:transparent; color:var(--text-color); border:1px dashed var(--border-color);">＋ パーツを追加</button>
      <div style="margin-bottom:4px;">詳細情報・メモ:</div>
      <textarea class="inv-desc" style="margin:0 0 8px 0; font-size:12px; padding:6px;" placeholder="共通の詳細を入力"></textarea>
      <div style="margin-bottom:4px;">金額/メモ:</div>
      <input type="text" class="inv-price" style="margin:0; font-size:12px; padding:6px;" placeholder="金額やメモを入力">
    `;

    const statusSel = editArea.querySelector('.inv-status');
    statusSel.value = st;
    statusSel.addEventListener('change', () => {
      updateSelectColor(statusSel);
      updateInventoryItemField(typeKey, character, name, 'status', statusSel.value);
    });

    const descArea = editArea.querySelector('.inv-desc');
    descArea.value = sampleItem.desc || '';
    descArea.addEventListener('change', () => updateInventoryItemField(typeKey, character, name, 'desc', descArea.value));

    const priceInput = editArea.querySelector('.inv-price');
    priceInput.value = sampleItem.price || '';
    priceInput.addEventListener('change', () => updateInventoryItemField(typeKey, character, name, 'price', priceInput.value));

    editArea.querySelector('.inv-rename').addEventListener('click', () => renameInventoryItemBulk(typeKey, character, name));

    const charSel = editArea.querySelector('.inv-character');
    charSel.add(new Option('未設定', ''));
    const seenChar = new Set();
    (movie.cast || []).forEach((c) => {
      if (c.character && !seenChar.has(c.character)) {
        seenChar.add(c.character);
        charSel.add(new Option(c.actor ? `${c.character}（${c.actor}）` : c.character, c.character));
      }
    });
    if (character && !seenChar.has(character)) charSel.add(new Option(character, character));
    charSel.value = character;
    charSel.addEventListener('change', () => updateInventoryItemField(typeKey, character, name, 'character', charSel.value));

    const partsWrap = editArea.querySelector('.inv-parts');
    const commitParts = () => {
      const arr = [...partsWrap.querySelectorAll('.inv-part-row')].map((row) => ({
        name: row.querySelector('.inv-part').value.trim(),
        desc: row.querySelector('.inv-part-desc').value.trim(),
        status: safeStatus(row.querySelector('.inv-part-status').value)
      })).filter((p) => p.name);
      updateInventoryItemField(typeKey, character, name, 'parts', arr);
    };
    const addPartRow = (part = {}) => {
      const row = document.createElement('div');
      row.className = 'inv-part-row';
      row.style.cssText = 'display:flex; gap:6px; margin-bottom:6px; align-items:center; flex-wrap:wrap;';
      const sel = document.createElement('select');
      sel.className = 'inv-part-status status-color';
      sel.style.cssText = 'width:auto; margin:0; padding:4px 6px; font-size:12px;';
      ['未着手', '準備中', '準備完了'].forEach((o) => sel.add(new Option(o, o)));
      sel.value = safeStatus(part.status || '未着手');
      updateSelectColor(sel);
      sel.addEventListener('change', () => { updateSelectColor(sel); commitParts(); });
      const nm = document.createElement('input');
      nm.type = 'text'; nm.className = 'inv-part'; nm.placeholder = 'パーツ名'; nm.value = part.name || '';
      nm.style.cssText = 'margin:0; font-size:12px; padding:6px; flex:1; min-width:80px;';
      nm.addEventListener('change', commitParts);
      const ds = document.createElement('input');
      ds.type = 'text'; ds.className = 'inv-part-desc'; ds.placeholder = '詳細(任意)'; ds.value = part.desc || '';
      ds.style.cssText = 'margin:0; font-size:12px; padding:6px; flex:1; min-width:80px;';
      ds.addEventListener('change', commitParts);
      const rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'item-remove-btn'; rm.style.cssText = 'position:static; padding:6px 10px;'; rm.textContent = '✕';
      rm.addEventListener('click', () => { row.remove(); commitParts(); });
      row.append(sel, nm, ds, rm);
      partsWrap.appendChild(row);
    };
    (sampleItem.parts || []).forEach((p) => addPartRow(typeof p === 'string' ? { name: p } : (p || {})));
    editArea.querySelector('.inv-add-part').addEventListener('click', () => addPartRow({}));

    content.appendChild(editArea);

    if (sampleItem.parts && sampleItem.parts.length) {
      const info = document.createElement('div');
      info.style.cssText = 'margin-bottom:12px; font-size:13px;';
      info.innerHTML = partsHtml(sampleItem.parts);
      content.appendChild(info);
    }

    matchingScenes
      .sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true, sensitivity: 'base' }))
      .forEach((scene) => content.appendChild(createSceneCard(scene)));

    details.appendChild(content);
    listContainer.appendChild(details);
  });
}

export async function updateInventoryItemField(typeKey, character, itemName, fieldKey, newValue) {
  const now = getNowFormattedString();
  await updateMovie(state.currentMovieId, (data) => {
    data.scenes.forEach((scene) => {
      const items = scene[typeKey] || [];
      let isChanged = false;
      items.forEach((item) => {
        if (item.name === itemName && (item.character || '') === character) {
          item[fieldKey] = (fieldKey === 'parts' && Array.isArray(newValue)) ? newValue.map((p) => ({ ...p })) : newValue;
          isChanged = true;
        }
      });
      if (isChanged) scene.updatedAt = now;
    });
  });
}

export async function renameInventoryItemBulk(typeKey, character, oldName) {
  const newName = prompt(`「${oldName}」の新しい名称を入力してください`, oldName);
  if (!newName || newName.trim() === '' || newName.trim() === oldName) return;
  const trimmed = newName.trim();
  const now = getNowFormattedString();

  await updateMovie(state.currentMovieId, (data) => {
    data.scenes.forEach((scene) => {
      const items = scene[typeKey] || [];
      let isChanged = false;
      items.forEach((item) => {
        if (item.name === oldName && (item.character || '') === character) {
          item.name = trimmed;
          isChanged = true;
        }
      });
      if (isChanged) scene.updatedAt = now;
    });
  });

  const oldKey = character + GSEP + oldName;
  const newKey = character + GSEP + trimmed;
  if (state.openedAccordionNames.has(oldKey)) {
    state.openedAccordionNames.delete(oldKey);
    state.openedAccordionNames.add(newKey);
  }

  showToast(`「${oldName}」をすべて「${trimmed}」に変更しました`);
}
