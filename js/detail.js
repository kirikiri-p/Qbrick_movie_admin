import { state } from './state.js';
import {
  escapeHtml, safeStatus, linkify, getNowFormattedString, syncItemStatuses
} from './utils.js';
import { updateMovie } from './firebase.js';
import { closeSceneDetail } from './nav.js';
import {
  addDateInput, addCostumeInput, addPropInput,
  collectDatesFromContainer, collectItemsFromDOM,
  renderCharacterCheckboxes, collectCharactersFromDOM
} from './items.js';
import { showToast } from './toast.js';

export function renderSceneViewDetail() {
  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  const scene = movie?.scenes.find((s) => s.id === state.currentSceneId);
  if (!scene) return;

  let titleText = `シーン ${scene.number}`;
  if (scene.sceneName) titleText += ` ｜ ${scene.sceneName}`;
  document.getElementById('view-scene-header').textContent = titleText;

  document.getElementById('view-scene-time-badge').textContent = scene.timeZone || '-';
  document.getElementById('view-scene-updated-at').textContent =
    scene.updatedAt ? `最終更新日時: ${scene.updatedAt}` : '最終更新日時: 未記録';

  const dateText = (scene.dates && scene.dates.length > 0) ? scene.dates.join(', ') : '未定';
  document.getElementById('view-scene-info').textContent = `場所: ${scene.location || '未定'} ｜ 撮影日: ${dateText}`;

  const memoArea = document.getElementById('view-scene-memo');
  if (memoArea) {
    if (scene.memo) {
      memoArea.innerHTML = `
        <strong>メモ・備考</strong><br>
        <div style="white-space: pre-wrap; background: rgba(0,0,0,0.03); padding: 8px; border-radius: 4px; word-break: break-all;">
          ${linkify(scene.memo)}
        </div>
      `;
      memoArea.style.display = 'block';
    } else {
      memoArea.style.display = 'none';
    }
  }

  renderCharacterView('view-scene-characters', scene);
  renderItemList('view-scene-costumes', '衣装', scene.costumes);
  renderItemList('view-scene-props', '小道具', scene.props);
}

function renderCharacterView(elementId, scene) {
  const container = document.getElementById(elementId);
  if (!container) return;
  container.innerHTML = '';

  const characters = scene.characters || [];
  if (characters.length === 0) return;

  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  const actorOf = {};
  ((movie && movie.cast) || []).forEach((c) => { if (c.character) actorOf[c.character] = c.actor || ''; });

  let html = `<strong style="color: var(--text-color);">登場人物</strong><br>`;
  characters.forEach((name) => {
    const actor = actorOf[name];
    const label = actor ? `${name}（${actor}）` : name;
    html += `<span class="character-badge">${escapeHtml(label)}</span>`;
  });
  container.innerHTML = html;
}

function renderItemList(elementId, label, items) {
  const container = document.getElementById(elementId);
  container.innerHTML = '';
  if (!items || items.length === 0) return;

  let html = `<strong style="color: var(--text-color);">${label}</strong><br>`;
  items.forEach((item) => {
    const st = safeStatus(item.status);
    html += `<div style="padding: 8px; border-left: 2px solid var(--border-color); margin-bottom: 4px; background: rgba(0,0,0,0.02); display:flex; flex-direction:column; align-items:flex-start;">
      <div style="display:flex; align-items:flex-start; width:100%;">
        <span class="status-color status-${st}" style="padding:2px 4px; font-size:11px; flex-shrink:0; margin-right:6px; margin-top:2px;">${escapeHtml(st)}</span>
        <strong style="word-break:break-all; line-height:1.4;">${escapeHtml(item.name)}</strong>
        ${item.character ? `<span class="character-badge" style="margin-left:6px; flex-shrink:0;">${escapeHtml(item.character)}</span>` : ''}
      </div>
      ${(item.parts && item.parts.length) ? `<div style="margin-top:6px; width:100%; display:flex; flex-wrap:wrap; gap:4px;">${item.parts.map((p) => `<span class="part-chip">${escapeHtml(p)}</span>`).join('')}</div>` : ''}
      ${item.desc ? `<div class="scene-info" style="margin-top: 4px; width:100%; word-break:break-all;">${escapeHtml(item.desc)}</div>` : ''}
      ${item.price ? `<div class="scene-info" style="color:var(--muted-text); width:100%; word-break:break-all;">${escapeHtml(item.price)}</div>` : ''}
    </div>`;
  });
  container.innerHTML = html;
}

let editCountObserversReady = false;
function updateEditCounts() {
  const c = document.querySelectorAll('#edit-costume-list .item-input-block').length;
  const p = document.querySelectorAll('#edit-prop-list .item-input-block').length;
  const cEl = document.getElementById('edit-costume-count');
  const pEl = document.getElementById('edit-prop-count');
  if (cEl) cEl.textContent = `（${c}件）`;
  if (pEl) pEl.textContent = `（${p}件）`;
}
function ensureEditCountObservers() {
  if (editCountObserversReady) return;
  const cList = document.getElementById('edit-costume-list');
  const pList = document.getElementById('edit-prop-list');
  if (!cList || !pList) return;
  const observer = new MutationObserver(updateEditCounts);
  observer.observe(cList, { childList: true });
  observer.observe(pList, { childList: true });
  editCountObserversReady = true;
}

export function renderSceneEditDetail() {
  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  const scene = movie?.scenes.find((s) => s.id === state.currentSceneId);
  if (!scene) return;

  document.getElementById('edit-scene-number').value = scene.number || '';
  document.getElementById('edit-scene-time-zone').value = scene.timeZone || '';
  document.getElementById('edit-scene-name').value = scene.sceneName || '';
  document.getElementById('edit-scene-location').value = scene.location || '';
  document.getElementById('edit-scene-memo').value = scene.memo || '';

  const dList = document.getElementById('edit-scene-dates');
  dList.innerHTML = '';
  if (scene.dates && scene.dates.length > 0) {
    scene.dates.forEach((d) => addDateInput('edit-scene-dates', d));
  } else {
    addDateInput('edit-scene-dates');
  }

  renderCharacterCheckboxes('edit-scene-characters', scene.characters || []);
  const charList = document.getElementById('edit-scene-characters');
  const updateCharCount = () => {
    const n = charList.querySelectorAll('.character-checkbox:checked').length;
    const el = document.getElementById('edit-character-count');
    if (el) el.textContent = `（${n}件）`;
  };
  charList.onchange = updateCharCount;
  updateCharCount();

  const cList = document.getElementById('edit-costume-list');
  cList.innerHTML = '';
  (scene.costumes || []).forEach((c) => addCostumeInput('edit-costume-list', c));

  const pList = document.getElementById('edit-prop-list');
  pList.innerHTML = '';
  (scene.props || []).forEach((p) => addPropInput('edit-prop-list', p));

  ensureEditCountObservers();
  updateEditCounts();
}

export function openSceneEdit() {
  document.getElementById('detail-pane-view').classList.add('hidden');
  document.getElementById('detail-pane-edit').classList.remove('hidden');

  document.getElementById('edit-acc-basic')?.setAttribute('open', 'true');
  document.getElementById('edit-acc-character')?.removeAttribute('open');
  document.getElementById('edit-acc-costume')?.removeAttribute('open');
  document.getElementById('edit-acc-prop')?.removeAttribute('open');

  renderSceneEditDetail();

  document.getElementById('detail-pane')?.scrollTo?.(0, 0);
}

export function cancelSceneEdit() {
  document.getElementById('detail-pane-edit').classList.add('hidden');
  document.getElementById('detail-pane-view').classList.remove('hidden');
}

export async function saveEditedScene() {
  if (!state.currentSceneId) return;
  const sceneId = state.currentSceneId;

  const fields = {
    number: document.getElementById('edit-scene-number').value,
    timeZone: document.getElementById('edit-scene-time-zone').value,
    sceneName: document.getElementById('edit-scene-name').value,
    location: document.getElementById('edit-scene-location').value,
    memo: document.getElementById('edit-scene-memo').value.trim(),
    dates: collectDatesFromContainer('edit-scene-dates'),
    characters: collectCharactersFromDOM('edit-scene-characters'),
    costumes: collectItemsFromDOM('edit-costume-list'),
    props: collectItemsFromDOM('edit-prop-list'),
    updatedAt: getNowFormattedString()
  };

  await updateMovie(state.currentMovieId, (data) => {
    const scene = data.scenes.find((s) => s.id === sceneId);
    if (!scene) return false;
    Object.assign(scene, fields);
    syncItemStatuses(data, fields.costumes, 'costumes');
    syncItemStatuses(data, fields.props, 'props');
  });

  state.renderedMovieId = null;
  state.renderedDailyDate = null;

  cancelSceneEdit();
  showToast('シーンの変更を保存しました');
}

export async function deleteScene() {
  if (!state.currentSceneId) return;
  if (!confirm('本当にこのシーンを削除してもよろしいですか？')) return;
  const sceneId = state.currentSceneId;

  await updateMovie(state.currentMovieId, (data) => {
    data.scenes = data.scenes.filter((s) => s.id !== sceneId);
  });
  closeSceneDetail();
}
