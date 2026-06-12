// エントリーポイント: 初期化・イベントの結線・Firestore購読。
import { state } from './state.js';
import { migrateSceneData, removeParticipation } from './utils.js';
import { subscribeMovies, createMovie, updateMovie, deleteMovieDoc } from './firebase.js';
import { handleHash } from './router.js';
import * as nav from './nav.js';
import { renderHome } from './home.js';
import {
  setViewMode, updateSort, deleteSelectedScenes, addScene
} from './movie.js';
import {
  openSceneEdit, cancelSceneEdit, saveEditedScene, deleteScene
} from './detail.js';
import { clearSearch, renderSearchResults } from './search.js';
import { handleExcelUpload, exportToExcel } from './excel.js';
import { addDateInput, addCostumeInput, addPropInput, checkSceneInput } from './items.js';
import { showToast } from './toast.js';
import { openCallsheetDialog, closeCallsheetDialog, generateCallsheet } from './callsheet.js';

const EDITOR_PASSWORD = 'きゅーぶりっく';

// ---- ダークモード（localStorageで永続化） -------------------------------------
function applyDarkMode(isDark) {
  const btn = document.getElementById('dark-mode-btn');
  document.body.classList.toggle('dark-mode', isDark);
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('darkMode', isDark ? 'true' : 'false');
}

// ---- 編集者モード -------------------------------------------------------------
function toggleEditorMode() {
  if (state.isEditorMode) {
    state.isEditorMode = false;
    document.body.classList.remove('editor-mode');
    document.getElementById('editor-toggle-btn').textContent = '編集者モードになる';
    state.selectedSceneIds.clear();
    document.getElementById('bulk-delete-btn')?.classList.add('hidden');
    showToast('閲覧モードに戻りました');
  } else {
    const pass = prompt('編集者用パスワードを入力してください');
    if (pass === EDITOR_PASSWORD) {
      state.isEditorMode = true;
      document.body.classList.add('editor-mode');
      document.getElementById('editor-toggle-btn').textContent = '閲覧モードに戻る';
      showToast('編集者モードに切り替わりました');
    } else if (pass !== null) {
      alert('パスワードが違います');
      return;
    } else {
      return;
    }
  }
  // 現在の画面をハッシュに基づいて再描画する
  handleHash(true);
}

// ---- 映画の追加・基本情報 -------------------------------------------------------
async function addMovie() {
  const titleInput = document.getElementById('new-movie-title');
  const title = titleInput.value.trim();
  if (!title) return;
  const newMovie = { id: Date.now(), title, scenes: [], type: '', director: '', year: '', icon: '🎬' };
  await createMovie(newMovie);
  titleInput.value = '';
  showToast(`「${title}」を追加しました`);
}

async function saveMovieDetails() {
  const title = document.getElementById('movie-detail-title').value.trim();
  if (!title) { alert('タイトルは必須です'); return; }
  const fields = {
    title,
    icon: document.getElementById('movie-detail-icon').value.trim(),
    type: document.getElementById('movie-detail-type').value,
    director: document.getElementById('movie-detail-director').value.trim(),
    year: document.getElementById('movie-detail-year').value.trim(),
  };
  await updateMovie(state.currentMovieId, (data) => { Object.assign(data, fields); });
  showToast('映画の情報を更新しました');
  nav.goHome();
}

async function deleteMovieFromDetails() {
  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  if (!movie) return;
  if (!confirm(`映画「${movie.title}」を本当に削除しますか？`)) return;
  await deleteMovieDoc(state.currentMovieId);
  removeParticipation(state.currentMovieId); // 端末に残る参加フラグも掃除する
  showToast('映画を削除しました');
  nav.goHome();
}

// ---- イベントの結線 -------------------------------------------------------------
function bind(id, eventName, handler) {
  document.getElementById(id)?.addEventListener(eventName, handler);
}

// 通信を伴うボタン用の結線。処理中はボタンを無効化して
// 二度押しによる重複登録・二重保存を防ぐ。
function bindAsync(id, handler, after = null) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', async () => {
    if (el.disabled) return;
    const originalText = el.textContent;
    el.disabled = true;
    el.textContent = '処理中…';
    try {
      await handler();
    } catch (e) {
      // エラー通知はupdateMovie等の内部で表示済み
    } finally {
      el.textContent = originalText;
      el.disabled = false;
      if (after) after();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // ダークモード復元
  applyDarkMode(localStorage.getItem('darkMode') === 'true');
  bind('dark-mode-btn', 'click', () => applyDarkMode(!document.body.classList.contains('dark-mode')));

  // ヘッダー
  document.querySelectorAll('.js-go-home').forEach((el) => el.addEventListener('click', nav.goHome));
  bind('header-movie-title-nav', 'click', nav.scrollToTop);
  bind('header-search-btn', 'click', nav.goSearch);

  // ホーム
  bindAsync('btn-add-movie', addMovie);
  bind('excel-upload', 'change', handleExcelUpload);
  bind('editor-toggle-btn', 'click', toggleEditorMode);

  // 映画の基本情報
  bindAsync('btn-save-movie-details', saveMovieDetails);
  bindAsync('btn-delete-movie-details', deleteMovieFromDetails);

  // 検索
  bind('btn-back-search', 'click', nav.backFromSearch);
  bind('btn-clear-search', 'click', () => clearSearch());
  document.querySelectorAll('#search-number, #search-location, #search-date, #search-costume, #search-prop')
    .forEach((el) => el.addEventListener('change', renderSearchResults));

  // 映画画面: 新規シーン追加フォーム
  bind('new-scene-number', 'input', checkSceneInput);
  bind('btn-add-date-new', 'click', () => addDateInput('new-scene-dates'));
  bind('btn-add-costume-new', 'click', () => addCostumeInput('new-costume-list'));
  bind('btn-add-prop-new', 'click', () => addPropInput('new-prop-list'));
  bindAsync('add-scene-btn', addScene, checkSceneInput);

  // 映画画面: 一覧の操作
  bind('btn-view-list', 'click', () => setViewMode('list'));
  bind('btn-view-cos', 'click', () => setViewMode('cos'));
  bind('btn-view-prop', 'click', () => setViewMode('prop'));
  bind('sort-select', 'change', (e) => updateSort(e.target.value));
  bindAsync('bulk-delete-btn', deleteSelectedScenes);
  bind('btn-export-excel', 'click', exportToExcel);

  // 日々スケジュール作成（日別画面）
  bind('btn-open-callsheet', 'click', openCallsheetDialog);
  bind('btn-cs-cancel', 'click', closeCallsheetDialog);
  bindAsync('btn-cs-generate', generateCallsheet);
  bind('cs-lunch-enabled', 'change', (e) => {
    document.getElementById('cs-lunch-detail').style.display = e.target.checked ? 'grid' : 'none';
  });
  // オーバーレイ（背景）タップで閉じる
  document.getElementById('callsheet-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'callsheet-modal') closeCallsheetDialog();
  });

  // シーン詳細パネル
  bind('btn-close-detail', 'click', nav.closeSceneDetail);
  bind('btn-open-edit', 'click', openSceneEdit);
  bind('btn-cancel-edit', 'click', cancelSceneEdit);
  bind('btn-cancel-edit-bottom', 'click', cancelSceneEdit);
  bind('btn-add-date-edit', 'click', () => addDateInput('edit-scene-dates'));
  bind('btn-add-costume-edit', 'click', () => addCostumeInput('edit-costume-list'));
  bind('btn-add-prop-edit', 'click', () => addPropInput('edit-prop-list'));
  bindAsync('btn-save-scene', saveEditedScene);
  bindAsync('btn-delete-scene', deleteScene);
});

// ---- ルーティング ----------------------------------------------------------------
window.addEventListener('hashchange', () => handleHash());

// ---- Firestore 購読 ---------------------------------------------------------------
let isInitialLoad = true;
subscribeMovies((snapshot) => {
  const loaded = [];
  snapshot.forEach((docSnap) => {
    // 1件壊れたデータがあっても全体が止まらないように個別にtry-catchする
    try {
      const data = docSnap.data();
      data.scenes = (Array.isArray(data.scenes) ? data.scenes : []).map(migrateSceneData);
      loaded.push(data);
    } catch (e) {
      console.error('読み込めないデータをスキップしました:', docSnap.id, e);
    }
  });
  state.movies = loaded;

  if (isInitialLoad) {
    isInitialLoad = false;
    handleHash();
  } else {
    handleHash(true);
  }
});
