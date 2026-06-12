// シーン詳細パネル（閲覧 / 編集）。
import { state } from './state.js';
import {
  escapeHtml, safeStatus, linkify, getNowFormattedString, syncItemStatuses
} from './utils.js';
import { updateMovie } from './firebase.js';
import { closeSceneDetail } from './nav.js';
import {
  addDateInput, addCostumeInput, addPropInput,
  collectDatesFromContainer, collectItemsFromDOM
} from './items.js';

// ---- 閲覧パネル ------------------------------------------------------------
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

  renderItemList('view-scene-costumes', '衣装', scene.costumes);
  renderItemList('view-scene-props', '小道具', scene.props);
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
      </div>
      ${item.desc ? `<div class="scene-info" style="margin-top: 4px; width:100%; word-break:break-all;">${escapeHtml(item.desc)}</div>` : ''}
      ${item.price ? `<div class="scene-info" style="color:var(--muted-text); width:100%; word-break:break-all;">${escapeHtml(item.price)}</div>` : ''}
    </div>`;
  });
  container.innerHTML = html;
}

// ---- 編集パネル ------------------------------------------------------------
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

  const cList = document.getElementById('edit-costume-list');
  cList.innerHTML = '';
  (scene.costumes || []).forEach((c) => addCostumeInput('edit-costume-list', c));

  const pList = document.getElementById('edit-prop-list');
  pList.innerHTML = '';
  (scene.props || []).forEach((p) => addPropInput('edit-prop-list', p));
}

export function openSceneEdit() {
  document.getElementById('detail-pane-view').classList.add('hidden');
  document.getElementById('detail-pane-edit').classList.remove('hidden');
  renderSceneEditDetail();
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
    costumes: collectItemsFromDOM('edit-costume-list'),
    props: collectItemsFromDOM('edit-prop-list'),
    updatedAt: getNowFormattedString()
  };

  // ローカルにも即時反映（画面のちらつき防止）
  const localMovie = state.movies.find((m) => m.id === state.currentMovieId);
  const localScene = localMovie?.scenes.find((s) => s.id === sceneId);
  if (localScene) Object.assign(localScene, fields);

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
  alert('シーンの変更を保存しました');
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
