// 映画画面: シーン一覧・シーンカード・衣装/小道具一覧（インベントリ）。
import { state } from './state.js';
import {
  escapeHtml, safeStatus, getSceneOverallStatus, getNowFormattedString, syncItemStatuses
} from './utils.js';
import { updateMovie } from './firebase.js';
import { goScene } from './nav.js';
import { collectDatesFromContainer, collectItemsFromDOM, addDateInput, updateSelectColor, checkSceneInput } from './items.js';

// ---- 表示モード・並べ替え ----------------------------------------------------
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

// ---- シーン一覧の描画 --------------------------------------------------------
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

// ---- シーンカード ------------------------------------------------------------
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

  // イベントは文字列埋め込みではなくリスナーで安全に紐づける
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

// ---- シーン選択・削除 ---------------------------------------------------------
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

  // 即時にローカルへ反映してから保存（onSnapshotで再描画される）
  const localMovie = state.movies.find((m) => m.id === movieId);
  const localScene = localMovie?.scenes.find((s) => s.id === sceneId);
  if (localScene) { localScene.status = newStatus; localScene.updatedAt = now; }

  await updateMovie(movieId, (data) => {
    const scene = data.scenes.find((s) => s.id === sceneId);
    if (!scene) return false;
    scene.status = newStatus;
    scene.updatedAt = now;
  });
}

// ---- 新しいシーンの追加 --------------------------------------------------------
export async function addScene() {
  const num = document.getElementById('new-scene-number').value.trim();
  const name = document.getElementById('new-scene-name').value.trim();
  const loc = document.getElementById('new-scene-location').value.trim();
  const timeZone = document.getElementById('new-scene-time-zone').value;
  const memo = document.getElementById('new-scene-memo').value.trim();
  const dates = collectDatesFromContainer('new-scene-dates');

  const newCostumes = collectItemsFromDOM('new-costume-list');
  const newProps = collectItemsFromDOM('new-prop-list');

  const newScene = {
    id: Date.now(), number: num, sceneName: name, location: loc, memo: memo, dates: dates,
    timeZone: timeZone, status: '未撮影', costumes: newCostumes, props: newProps,
    updatedAt: getNowFormattedString()
  };

  await updateMovie(state.currentMovieId, (data) => {
    data.scenes.push(newScene);
    syncItemStatuses(data, newCostumes, 'costumes');
    syncItemStatuses(data, newProps, 'props');
  });

  // フォームをリセット
  document.getElementById('new-scene-number').value = '';
  document.getElementById('new-scene-name').value = '';
  document.getElementById('new-scene-location').value = '';
  document.getElementById('new-scene-time-zone').value = '';
  document.getElementById('new-scene-memo').value = '';
  document.getElementById('new-scene-dates').innerHTML = '';
  addDateInput('new-scene-dates');
  document.getElementById('new-costume-list').innerHTML = '';
  document.getElementById('new-prop-list').innerHTML = '';
  document.getElementById('new-scene-details').removeAttribute('open');
  checkSceneInput();
}

// ---- 衣装・小道具一覧（インベントリ） -------------------------------------------
export function getUniqueItemNames(movie, typeKey) {
  const names = new Set();
  movie.scenes.forEach((s) => {
    const items = (typeKey === 'costumes' ? s.costumes : s.props) || [];
    items.forEach((item) => names.add(item.name));
  });
  return Array.from(names).sort();
}

function getEarliestDate(movie, typeKey, itemName) {
  const scenes = movie.scenes.filter((s) => {
    const items = (typeKey === 'costumes' ? s.costumes : s.props) || [];
    return items.some((i) => i.name === itemName) && s.dates && s.dates.length > 0;
  });
  if (scenes.length === 0) return null;
  const allDates = scenes.flatMap((s) => s.dates).sort();
  return allDates[0];
}

// アイテム名ごとの全インスタンスのステータス集合を返す
function getItemStatuses(movie, typeKey, itemName) {
  const statuses = new Set();
  movie.scenes.forEach((s) => {
    const items = (typeKey === 'costumes' ? s.costumes : s.props) || [];
    items.filter((i) => i.name === itemName).forEach((i) => statuses.add(i.status));
  });
  return statuses;
}

export function renderInventory(movie, listContainer, typeKey) {
  const uniqueNames = getUniqueItemNames(movie, typeKey);
  const typeLabel = typeKey === 'costumes' ? '衣装' : '小道具';

  if (uniqueNames.length === 0) {
    listContainer.innerHTML = `<p class="scene-info">まだ登録されていません。</p>`;
    return;
  }

  // ★新機能: 全体の達成率（準備完了のアイテム数 / 全アイテム数）
  const readyCount = uniqueNames.filter((name) => {
    const statuses = getItemStatuses(movie, typeKey, name);
    return statuses.size === 1 && statuses.has('準備完了');
  }).length;
  const ratePct = Math.round((readyCount / uniqueNames.length) * 100);

  const rateCard = document.createElement('div');
  rateCard.className = 'card card-no-click';
  rateCard.innerHTML = `
    <div class="rate-summary">
      <span>${typeLabel}の準備達成率</span>
      <span style="font-size: 20px;">${ratePct}%</span>
    </div>
    <div class="scene-info" style="margin-top: 2px;">準備完了: ${readyCount} / ${uniqueNames.length}個</div>
    <div class="progress-track">
      <div class="progress-fill" style="width: ${ratePct}%;"></div>
    </div>
  `;
  listContainer.appendChild(rateCard);

  uniqueNames.sort((a, b) => {
    if (state.currentSort === 'name-asc') return a.localeCompare(b);
    if (state.currentSort === 'date-asc') {
      const dateA = getEarliestDate(movie, typeKey, a);
      const dateB = getEarliestDate(movie, typeKey, b);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.localeCompare(dateB);
    }
    if (state.currentSort === 'count-desc') {
      const countA = movie.scenes.filter((s) => ((typeKey === 'costumes' ? s.costumes : s.props) || []).some((i) => i.name === a)).length;
      const countB = movie.scenes.filter((s) => ((typeKey === 'costumes' ? s.costumes : s.props) || []).some((i) => i.name === b)).length;
      return countB - countA;
    }
    return 0;
  });

  uniqueNames.forEach((name) => {
    const matchingScenes = movie.scenes.filter((s) => {
      const items = (typeKey === 'costumes' ? s.costumes : s.props) || [];
      return items.some((i) => i.name === name);
    });

    const sampleItem = matchingScenes[0][typeKey].find((i) => i.name === name) || {};

    const itemStatuses = getItemStatuses(movie, typeKey, name);
    let statusHtml = '';
    if (itemStatuses.size === 1) {
      const st = safeStatus(Array.from(itemStatuses)[0]);
      statusHtml = `<span class="inventory-status-badge status-color status-${st}">${escapeHtml(st)}</span>`;
    }

    // ★新機能: 「最速使用日が早い順」で並べ替え中は最速使用日を表示する
    let earliestHtml = '';
    if (state.currentSort === 'date-asc') {
      const earliest = getEarliestDate(movie, typeKey, name);
      earliestHtml = `<div class="earliest-date-label">最速使用日: ${escapeHtml(earliest || '未定')}</div>`;
    }

    const details = document.createElement('details');
    details.className = 'accordion inventory-accordion';

    if (state.openedAccordionNames.has(name)) {
      details.setAttribute('open', 'true');
    }

    details.addEventListener('toggle', () => {
      if (details.hasAttribute('open')) state.openedAccordionNames.add(name);
      else state.openedAccordionNames.delete(name);
    });

    const summary = document.createElement('summary');
    summary.innerHTML = `
      <div style="display:flex; align-items:flex-start; width:100%;">
        <div style="flex-shrink:0; margin-top:2px;">${statusHtml}</div>
        <div style="flex:1; word-break:break-all; line-height:1.4;">${escapeHtml(name)}${earliestHtml}</div>
        <div style="flex-shrink:0; white-space:nowrap; margin-left:8px; font-weight:normal; font-size:12px; color:var(--muted-text);">(${matchingScenes.length}件)</div>
      </div>
    `;
    details.appendChild(summary);

    const content = document.createElement('div');
    content.className = 'accordion-content';

    // ★新機能: 一括管理マネージャーは編集者モードのみ表示（.editor-only）
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
      <div style="margin-bottom:4px;">詳細情報・メモ:</div>
      <textarea class="inv-desc" style="margin:0 0 8px 0; font-size:12px; padding:6px;" placeholder="共通の詳細を入力"></textarea>
      <div style="margin-bottom:4px;">金額/メモ:</div>
      <input type="text" class="inv-price" style="margin:0; font-size:12px; padding:6px;" placeholder="金額やメモを入力">
    `;

    // ユーザー由来の値は .value で安全に流し込む（引用符を含む名前でも壊れない）
    const statusSel = editArea.querySelector('.inv-status');
    statusSel.value = st;
    statusSel.addEventListener('change', () => {
      updateSelectColor(statusSel);
      updateInventoryItemField(typeKey, name, 'status', statusSel.value);
    });

    const descArea = editArea.querySelector('.inv-desc');
    descArea.value = sampleItem.desc || '';
    descArea.addEventListener('change', () => updateInventoryItemField(typeKey, name, 'desc', descArea.value));

    const priceInput = editArea.querySelector('.inv-price');
    priceInput.value = sampleItem.price || '';
    priceInput.addEventListener('change', () => updateInventoryItemField(typeKey, name, 'price', priceInput.value));

    editArea.querySelector('.inv-rename').addEventListener('click', () => renameInventoryItemBulk(typeKey, name));

    content.appendChild(editArea);

    matchingScenes
      .sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true, sensitivity: 'base' }))
      .forEach((scene) => content.appendChild(createSceneCard(scene)));

    details.appendChild(content);
    listContainer.appendChild(details);
  });
}

export async function updateInventoryItemField(typeKey, itemName, fieldKey, newValue) {
  const now = getNowFormattedString();
  await updateMovie(state.currentMovieId, (data) => {
    data.scenes.forEach((scene) => {
      const items = scene[typeKey] || [];
      let isChanged = false;
      items.forEach((item) => {
        if (item.name === itemName) {
          item[fieldKey] = newValue;
          isChanged = true;
        }
      });
      if (isChanged) scene.updatedAt = now;
    });
  });
}

export async function renameInventoryItemBulk(typeKey, oldName) {
  const newName = prompt(`「${oldName}」の新しい名称を入力してください`, oldName);
  if (!newName || newName.trim() === '' || newName.trim() === oldName) return;
  const trimmed = newName.trim();
  const now = getNowFormattedString();

  await updateMovie(state.currentMovieId, (data) => {
    data.scenes.forEach((scene) => {
      const items = scene[typeKey] || [];
      let isChanged = false;
      items.forEach((item) => {
        if (item.name === oldName) {
          item.name = trimmed;
          isChanged = true;
        }
      });
      if (isChanged) scene.updatedAt = now;
    });
  });

  if (state.openedAccordionNames.has(oldName)) {
    state.openedAccordionNames.delete(oldName);
    state.openedAccordionNames.add(trimmed);
  }

  alert(`「${oldName}」をすべて「${trimmed}」に変更しました。`);
}
