import { state } from './state.js';
import { migrateSceneData, migrateMovieData, removeParticipation } from './utils.js';
import { subscribeMovies, createMovie, updateMovie, deleteMovieDoc } from './firebase.js';
import { handleHash } from './router.js';
import * as nav from './nav.js';
import { renderHome } from './home.js';
import {
  setViewMode, updateSort, deleteSelectedScenes, addScene, renderMovie
} from './movie.js';
import {
  openSceneEdit, cancelSceneEdit, saveEditedScene, deleteScene, isEditDirty
} from './detail.js';
import { clearSearch, renderSearchResults } from './search.js';
import { handleExcelUpload, exportToExcel } from './excel.js';
import { addDateInput, addCostumeInput, addPropInput, checkSceneInput, addCastInput, collectCastFromDOM, addDirectorInput, collectDirectorsFromDOM } from './items.js';
import { showToast } from './toast.js';
import { openCallsheetDialog, closeCallsheetDialog, generateCallsheet } from './callsheet.js';

const EDITOR_PASSWORD = 'きゅーぶりっく';

function applyDarkMode(isDark) {
  const btn = document.getElementById('dark-mode-btn');
  document.body.classList.toggle('dark-mode', isDark);
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('darkMode', isDark ? 'true' : 'false');
}

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

  handleHash(true);
}

async function addMovie() {
  const titleInput = document.getElementById('new-movie-title');
  const title = titleInput.value.trim();
  if (!title) return;
  const newMovie = { id: Date.now(), title, scenes: [], type: '', directors: [], year: '', icon: '🎬', cast: [] };
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
    directors: collectDirectorsFromDOM('movie-detail-directors'),
    year: document.getElementById('movie-detail-year').value.trim(),
    cast: collectCastFromDOM('movie-detail-cast'),
  };
  await updateMovie(state.currentMovieId, (data) => { Object.assign(data, fields); });
  showToast('映画の情報を更新しました');
  nav.goHome();
}

async function deleteMovieFromDetails() {
  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  if (!movie) return;
  if (!confirm(`映画「${movie.title}」を本当に削除しますか？`)) return;
  const snapshot = JSON.parse(JSON.stringify(movie));
  await deleteMovieDoc(state.currentMovieId);
  removeParticipation(state.currentMovieId);
  nav.goHome();
  showToast('映画を削除しました', {
    actionLabel: '元に戻す',
    onAction: async () => {
      try {
        await createMovie(snapshot);
        showToast('元に戻しました');
      } catch (e) { /* 通知済み */ }
    }
  });
}

function bind(id, eventName, handler) {
  document.getElementById(id)?.addEventListener(eventName, handler);
}

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

    } finally {
      el.textContent = originalText;
      el.disabled = false;
      if (after) after();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {

  applyDarkMode(localStorage.getItem('darkMode') === 'true');
  bind('dark-mode-btn', 'click', () => applyDarkMode(!document.body.classList.contains('dark-mode')));

  document.querySelectorAll('.js-go-home').forEach((el) => el.addEventListener('click', nav.goHome));
  bind('header-movie-title-nav', 'click', nav.scrollToTop);
  bind('header-search-btn', 'click', nav.goSearch);

  bindAsync('btn-add-movie', addMovie);
  bind('excel-upload', 'change', handleExcelUpload);
  bind('editor-toggle-btn', 'click', toggleEditorMode);

  bindAsync('btn-save-movie-details', saveMovieDetails);
  bindAsync('btn-delete-movie-details', deleteMovieFromDetails);
  bind('btn-add-cast', 'click', () => addCastInput('movie-detail-cast'));
  bind('btn-add-director', 'click', () => addDirectorInput('movie-detail-directors'));

  bind('btn-back-search', 'click', nav.backFromSearch);
  bind('btn-clear-search', 'click', () => clearSearch());
  document.querySelectorAll('#search-number, #search-location, #search-date, #search-character, #search-costume, #search-prop')
    .forEach((el) => el.addEventListener('change', renderSearchResults));

  bind('new-scene-number', 'input', checkSceneInput);
  bind('btn-add-date-new', 'click', () => addDateInput('new-scene-dates'));
  bind('btn-add-costume-new', 'click', () => addCostumeInput('new-costume-list'));
  bind('btn-add-prop-new', 'click', () => addPropInput('new-prop-list'));
  bindAsync('add-scene-btn', addScene, checkSceneInput);

  bind('btn-view-list', 'click', () => setViewMode('list'));
  bind('btn-view-cos', 'click', () => setViewMode('cos'));
  bind('btn-view-prop', 'click', () => setViewMode('prop'));
  bind('sort-select', 'change', (e) => updateSort(e.target.value));
  bind('unprepared-filter', 'change', (e) => { state.showUnpreparedOnly = e.target.checked; renderMovie(); });
  bindAsync('bulk-delete-btn', deleteSelectedScenes);
  bind('btn-export-excel', 'click', exportToExcel);

  bind('btn-open-callsheet', 'click', openCallsheetDialog);
  bind('btn-cs-cancel', 'click', closeCallsheetDialog);
  bindAsync('btn-cs-generate', generateCallsheet);
  bind('cs-lunch-enabled', 'change', (e) => {
    document.getElementById('cs-lunch-detail').style.display = e.target.checked ? 'grid' : 'none';
  });

  document.getElementById('callsheet-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'callsheet-modal') closeCallsheetDialog();
  });

  bind('btn-close-detail', 'click', () => {
    if (isEditDirty() && !confirm('編集中の変更が保存されていません。破棄してよいですか？')) return;
    nav.closeSceneDetail();
  });
  bind('btn-open-edit', 'click', openSceneEdit);
  bind('btn-cancel-edit', 'click', cancelSceneEdit);
  bind('btn-cancel-edit-bottom', 'click', cancelSceneEdit);
  bind('btn-add-date-edit', 'click', () => addDateInput('edit-scene-dates'));
  bind('btn-add-costume-edit', 'click', () => addCostumeInput('edit-costume-list'));
  bind('btn-add-prop-edit', 'click', () => addPropInput('edit-prop-list'));
  bindAsync('btn-save-scene', saveEditedScene);
  bindAsync('btn-delete-scene', deleteScene);
});

window.addEventListener('beforeunload', (e) => {
  if (isEditDirty()) { e.preventDefault(); e.returnValue = ''; }
});

window.addEventListener('hashchange', () => handleHash());

let isInitialLoad = true;
subscribeMovies((snapshot) => {
  const loaded = [];
  snapshot.forEach((docSnap) => {

    try {
      const data = migrateMovieData(docSnap.data());
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
