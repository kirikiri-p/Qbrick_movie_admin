// ルーター: location.hash を解釈して各画面を描画する。
import { state } from './state.js';
import { getParticipation, escapeHtml } from './utils.js';
import { renderHome } from './home.js';
import { renderMovie, createSceneCard } from './movie.js';
import { renderSceneViewDetail, renderSceneEditDetail } from './detail.js';
import { populateSearchFilters, restoreSearchFilters, clearSearch } from './search.js';
import { addDateInput, addCastInput, renderCharacterCheckboxes } from './items.js';
import { setViewMode } from './movie.js';

export function handleHash(isDataUpdate = false) {
  const hash = window.location.hash.replace('#', '');
  if (!hash || hash === 'home') {
    executeGoHome(isDataUpdate);
  } else if (hash.startsWith('movie/')) {
    const parts = hash.split('/');
    if (parts.length === 2) {
      executeGoMovie(parseInt(parts[1]), isDataUpdate);
    } else if (parts[2] === 'scene') {
      executeGoScene(parseInt(parts[3]), parseInt(parts[1]), null, isDataUpdate);
    }
  } else if (hash.startsWith('daily/')) {
    const parts = hash.split('/');
    if (parts.length === 2) {
      executeGoDaily(parts[1], isDataUpdate);
    } else if (parts[2] === 'scene') {
      executeGoScene(parseInt(parts[4]), parseInt(parts[3]), parts[1], isDataUpdate);
    }
  } else if (hash.startsWith('search/')) {
    const parts = hash.split('/');
    if (parts.length === 2) {
      executeGoSearch(parseInt(parts[1]), isDataUpdate, true);
    } else if (parts[2] === 'scene') {
      executeGoSearchScene(parseInt(parts[3]), parseInt(parts[1]), isDataUpdate);
    }
  } else if (hash.startsWith('details/')) {
    executeGoMovieDetails(parseInt(hash.split('/')[1]), isDataUpdate);
  }
}

export function showViewUI(viewId) {
  ['view-home', 'view-movie', 'view-daily', 'view-search', 'view-movie-details'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  document.getElementById(viewId).classList.remove('hidden');

  const searchBtn = document.getElementById('header-search-btn');
  if (viewId === 'view-movie') {
    searchBtn?.classList.remove('hidden');
  } else {
    searchBtn?.classList.add('hidden');
  }
}

function executeGoHome(isDataUpdate) {
  document.body.style.overflow = '';
  state.currentMovieId = null;
  renderHome();
  document.getElementById('header-movie-title-nav').classList.add('hidden');
  document.getElementById('header-main-title').textContent = '製作映画一覧';
  showViewUI('view-home');
}

function executeGoMovie(mId, isDataUpdate) {
  document.body.style.overflow = '';
  state.currentMovieId = mId;
  state.selectedSceneIds.clear();
  document.getElementById('bulk-delete-btn').classList.add('hidden');

  document.getElementById('movie-detail-container')?.classList.remove('has-detail');

  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  if (!movie) {
    // 他の端末で削除された等で映画が見つからない場合はホームへ戻す
    window.location.hash = 'home';
    return;
  }
  document.getElementById('header-movie-title-nav').classList.remove('hidden');
  document.getElementById('header-title-sub').textContent = movie.title;
  document.getElementById('header-main-title').textContent = movie.title;

  if (!isDataUpdate && state.renderedMovieId !== state.currentMovieId) {
    document.getElementById('new-scene-dates').innerHTML = '';
    addDateInput('new-scene-dates');
    renderCharacterCheckboxes('new-scene-characters', []);
    setViewMode('list');
    populateSearchFilters();
    renderMovie();
  } else if (isDataUpdate) {
    populateSearchFilters();
    renderMovie();
  }

  document.getElementById('detail-pane').classList.remove('show-detail');
  state.currentSceneId = null;
  showViewUI('view-movie');
}

function executeGoScene(sId, mId, dailyDateStr, isDataUpdate) {
  state.currentMovieId = mId;
  state.currentSceneId = sId;
  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  if (!movie) {
    // 他の端末で削除された等で映画が見つからない場合はホームへ戻す
    window.location.hash = 'home';
    return;
  }

  const detailPane = document.getElementById('detail-pane');

  if (dailyDateStr) {
    document.getElementById('header-movie-title-nav').classList.remove('hidden');
    document.getElementById('header-title-sub').textContent = `${dailyDateStr} の予定`;
    document.getElementById('daily-detail-container').appendChild(detailPane);
    if (!isDataUpdate && state.renderedDailyDate !== dailyDateStr) {
      executeGoDaily(dailyDateStr, false, true);
    }
    showViewUI('view-daily');
  } else {
    document.getElementById('header-movie-title-nav').classList.remove('hidden');
    document.getElementById('header-title-sub').textContent = movie.title;
    document.getElementById('movie-detail-container').appendChild(detailPane);

    if (!isDataUpdate && state.renderedMovieId !== state.currentMovieId) {
      renderMovie();
    }
    showViewUI('view-movie');
  }

  if (!isDataUpdate) {
    document.getElementById('detail-pane-edit').classList.add('hidden');
    document.getElementById('detail-pane-view').classList.remove('hidden');
  }

  if (document.getElementById('detail-pane-edit').classList.contains('hidden')) {
    renderSceneViewDetail();
  } else if (!isDataUpdate) {
    renderSceneEditDetail();
  }

  detailPane.classList.add('show-detail');
  detailPane.closest('.detail-pane-container')?.classList.add('has-detail');

  if (window.innerWidth < 800) {
    document.body.style.overflow = 'hidden';
  }
}

function executeGoSearchScene(sId, mId, isDataUpdate) {
  state.currentMovieId = mId;
  state.currentSceneId = sId;
  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  if (!movie) {
    // 他の端末で削除された等で映画が見つからない場合はホームへ戻す
    window.location.hash = 'home';
    return;
  }

  const detailPane = document.getElementById('detail-pane');
  document.getElementById('search-detail-container').appendChild(detailPane);

  if (!isDataUpdate) {
    populateSearchFilters();
    restoreSearchFilters();
  }

  if (!isDataUpdate) {
    document.getElementById('detail-pane-edit').classList.add('hidden');
    document.getElementById('detail-pane-view').classList.remove('hidden');
  }

  if (document.getElementById('detail-pane-edit').classList.contains('hidden')) {
    renderSceneViewDetail();
  } else if (!isDataUpdate) {
    renderSceneEditDetail();
  }

  detailPane.classList.add('show-detail');
  detailPane.closest('.detail-pane-container')?.classList.add('has-detail');

  if (window.innerWidth < 800) {
    document.body.style.overflow = 'hidden';
  }
  showViewUI('view-search');
}

function executeGoSearch(mId, isDataUpdate = false, preserveFilters = false) {
  document.body.style.overflow = '';
  state.currentMovieId = mId;

  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  if (!movie) {
    // 他の端末で削除された等で映画が見つからない場合はホームへ戻す
    window.location.hash = 'home';
    return;
  }

  const detailPane = document.getElementById('detail-pane');
  detailPane.classList.remove('show-detail');
  document.getElementById('search-detail-container')?.classList.remove('has-detail');
  state.currentSceneId = null;

  populateSearchFilters();

  if (!isDataUpdate && !preserveFilters) {
    clearSearch(false);
  } else {
    restoreSearchFilters();
  }

  showViewUI('view-search');
}

function executeGoMovieDetails(mId, isDataUpdate) {
  document.body.style.overflow = '';
  state.currentMovieId = mId;
  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  if (!movie) {
    // 他の端末で削除された等で映画が見つからない場合はホームへ戻す
    window.location.hash = 'home';
    return;
  }
  if (!isDataUpdate) {
    document.getElementById('movie-detail-title').value = movie.title || '';
    document.getElementById('movie-detail-icon').value = movie.icon || '';
    document.getElementById('movie-detail-type').value = movie.type || '';
    document.getElementById('movie-detail-director').value = movie.director || '';
    document.getElementById('movie-detail-year').value = movie.year || '';

    const castContainer = document.getElementById('movie-detail-cast');
    castContainer.innerHTML = '';
    if (movie.cast && movie.cast.length > 0) {
      movie.cast.forEach((c) => addCastInput('movie-detail-cast', c));
    } else {
      addCastInput('movie-detail-cast');
    }
  }
  showViewUI('view-movie-details');
}

export function executeGoDaily(dateStr, isDataUpdate, skipRenderIfLoaded = false) {
  document.body.style.overflow = '';
  state.renderedDailyDate = dateStr;

  document.getElementById('daily-detail-container')?.classList.remove('has-detail');

  document.getElementById('header-movie-title-nav').classList.remove('hidden');
  document.getElementById('header-title-sub').textContent = `${dateStr} の予定`;
  document.getElementById('header-main-title').textContent = `${dateStr} の撮影予定`;
  document.getElementById('daily-date-title').textContent = `${dateStr} の撮影予定`;

  const container = document.getElementById('daily-scene-list-container');

  if (skipRenderIfLoaded && container.children.length > 0) {
    // すでに描画済みなのでスキップ
  } else {
    container.innerHTML = '';
    const activeScenes = [];
    state.movies.forEach((m) => {
      if (getParticipation(m.id)) m.scenes.forEach((s) => activeScenes.push({ movie: m, scene: s }));
    });

    const dayScenes = activeScenes.filter((item) => item.scene.dates && item.scene.dates.includes(dateStr));

    dayScenes
      .sort((a, b) => String(a.scene.number).localeCompare(String(b.scene.number), undefined, { numeric: true, sensitivity: 'base' }))
      .forEach((item) => {
        const card = createSceneCard(item.scene, item.movie.id);
        const titleObj = document.createElement('div');
        const icon = escapeHtml(item.movie.icon || '🎬');
        titleObj.innerHTML = `<strong style="color: #1976d2; font-size: 14px;">${icon} 映画: ${escapeHtml(item.movie.title)}</strong><hr style="border:0; border-top:1px dashed #ccc; margin: 4px 0;">`;
        card.prepend(titleObj);
        container.appendChild(card);
      });
  }
  showViewUI('view-daily');
}
