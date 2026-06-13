// 画面遷移（location.hash の書き換え）だけを担当する小さなモジュール。
// 実際の描画は router.js が hashchange を受けて行う。
import { state } from './state.js';

export function goHome() { window.location.hash = 'home'; }
export function goMovie(id) { window.location.hash = 'movie/' + id; }
export function goMovieDetails(id) { window.location.hash = 'details/' + id; }
export function showDailyScenes(dateStr) { window.location.hash = `daily/${dateStr}`; }
export function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

export function goSearch() {
  state.lastSearchFilters = { number: '', location: '', date: '', character: '', costume: '', prop: '' };
  window.location.hash = 'search/' + state.currentMovieId;
}

export function backFromSearch() {
  window.location.hash = `movie/${state.currentMovieId}`;
}

export function goScene(sceneId, forceMovieId = null) {
  const currentHash = window.location.hash.replace('#', '');

  if (currentHash.startsWith('search/')) {
    // 検索画面から離れる前に、選択中のフィルタを保存しておく
    state.lastSearchFilters.number = document.getElementById('search-number')?.value || '';
    state.lastSearchFilters.location = document.getElementById('search-location')?.value || '';
    state.lastSearchFilters.date = document.getElementById('search-date')?.value || '';
    state.lastSearchFilters.character = document.getElementById('search-character')?.value || '';
    state.lastSearchFilters.costume = document.getElementById('search-costume')?.value || '';
    state.lastSearchFilters.prop = document.getElementById('search-prop')?.value || '';

    window.location.hash = `search/${forceMovieId || state.currentMovieId}/scene/${sceneId}`;
  } else if (currentHash.startsWith('daily/')) {
    const dateStr = currentHash.split('/')[1];
    window.location.hash = `daily/${dateStr}/scene/${forceMovieId || state.currentMovieId}/${sceneId}`;
  } else {
    window.location.hash = `movie/${forceMovieId || state.currentMovieId}/scene/${sceneId}`;
  }
}

export function closeSceneDetail() {
  const detailPane = document.getElementById('detail-pane');
  detailPane.classList.remove('show-detail');
  detailPane.closest('.detail-pane-container')?.classList.remove('has-detail');
  state.currentSceneId = null;
  document.body.style.overflow = '';

  const currentHash = window.location.hash.replace('#', '');

  if (currentHash.startsWith('daily/')) {
    const dateStr = currentHash.split('/')[1];
    window.location.hash = `daily/${dateStr}`;
  } else if (currentHash.startsWith('search/')) {
    window.location.hash = `search/${state.currentMovieId}`;
  } else {
    window.location.hash = `movie/${state.currentMovieId}`;
  }
}
