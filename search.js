// シーン検索画面。
import { state } from './state.js';
import { createSceneCard, getUniqueItemNames } from './movie.js';

function getUniqueProperties(movie, propName) {
  const items = new Set();
  movie.scenes.forEach((s) => {
    if (propName === 'dates') {
      if (s.dates && s.dates.length > 0) s.dates.forEach((d) => items.add(d));
      else items.add('未定');
    } else {
      if (s[propName]) items.add(s[propName]);
      else if (propName === 'location') items.add('未定');
    }
  });
  const arr = Array.from(items);
  if (propName === 'number') {
    arr.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));
  } else {
    arr.sort();
  }
  return arr;
}

export function populateSearchFilters() {
  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  if (!movie) return;

  const numSel = document.getElementById('search-number');
  const locSel = document.getElementById('search-location');
  const dateSel = document.getElementById('search-date');
  const cosSel = document.getElementById('search-costume');
  const propSel = document.getElementById('search-prop');

  [numSel, locSel, dateSel, cosSel, propSel].forEach((s) => {
    const currentVal = s.value;
    s.innerHTML = '<option value="">すべて</option>';
    s.dataset.current = currentVal;
  });

  // new Option(text, value) は内部で textContent を使うためエスケープ不要で安全
  getUniqueProperties(movie, 'number').forEach((v) => numSel.add(new Option(v, v)));
  getUniqueProperties(movie, 'location').forEach((v) => locSel.add(new Option(v, v)));
  getUniqueProperties(movie, 'dates').forEach((v) => dateSel.add(new Option(v, v)));
  getUniqueItemNames(movie, 'costumes').forEach((v) => cosSel.add(new Option(v, v)));
  getUniqueItemNames(movie, 'props').forEach((v) => propSel.add(new Option(v, v)));

  [numSel, locSel, dateSel, cosSel, propSel].forEach((s) => {
    if (s.dataset.current) s.value = s.dataset.current;
  });
}

export function restoreSearchFilters() {
  const f = state.lastSearchFilters;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('search-number', f.number);
  set('search-location', f.location);
  set('search-date', f.date);
  set('search-costume', f.costume);
  set('search-prop', f.prop);
  renderSearchResults();
}

export function clearSearch(doRender = true) {
  ['number', 'location', 'date', 'costume', 'prop'].forEach((id) => {
    document.getElementById('search-' + id).value = '';
  });
  if (doRender) renderSearchResults();
}

export function renderSearchResults() {
  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  const list = document.getElementById('search-result-list');
  list.innerHTML = '';

  if (!movie || movie.scenes.length === 0) {
    list.innerHTML = '<p class="scene-info">まだシーンがありません。</p>';
    return;
  }

  const filterNum = document.getElementById('search-number').value;
  const filterLoc = document.getElementById('search-location').value;
  const filterDate = document.getElementById('search-date').value;
  const filterCos = document.getElementById('search-costume').value;
  const filterProp = document.getElementById('search-prop').value;

  state.lastSearchFilters = {
    number: filterNum, location: filterLoc, date: filterDate, costume: filterCos, prop: filterProp
  };

  if (!filterNum && !filterLoc && !filterDate && !filterCos && !filterProp) {
    list.innerHTML = '<p class="scene-info">検索条件を選択してください</p>';
    return;
  }

  let displayScenes = [...movie.scenes];

  if (filterNum) displayScenes = displayScenes.filter((s) => String(s.number) === String(filterNum));
  if (filterLoc) {
    if (filterLoc === '未定') displayScenes = displayScenes.filter((s) => !s.location);
    else displayScenes = displayScenes.filter((s) => s.location === filterLoc);
  }
  if (filterDate) {
    if (filterDate === '未定') displayScenes = displayScenes.filter((s) => !s.dates || s.dates.length === 0);
    else displayScenes = displayScenes.filter((s) => s.dates && s.dates.includes(filterDate));
  }
  if (filterCos) displayScenes = displayScenes.filter((s) => (s.costumes || []).some((c) => c.name === filterCos));
  if (filterProp) displayScenes = displayScenes.filter((s) => (s.props || []).some((p) => p.name === filterProp));

  displayScenes.sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true, sensitivity: 'base' }));

  displayScenes.forEach((scene) => list.appendChild(createSceneCard(scene)));

  if (displayScenes.length === 0) {
    list.innerHTML = '<p class="scene-info">条件に合うシーンが見つかりませんでした</p>';
  }
}
