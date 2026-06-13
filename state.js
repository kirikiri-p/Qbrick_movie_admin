// アプリ全体で共有する状態。
// 各モジュールは `state.currentMovieId` のようにプロパティ経由で読み書きする。
export const state = {
  movies: [],

  currentMovieId: null,
  currentSceneId: null,

  currentViewMode: 'list',   // 'list' | 'cos' | 'prop'
  currentSort: 'num-asc',

  selectedSceneIds: new Set(),
  openedAccordionNames: new Set(),

  isEditorMode: false,

  globalCalYear: new Date().getFullYear(),
  globalCalMonth: new Date().getMonth(),

  renderedMovieId: null,
  renderedDailyDate: null,

  lastSearchFilters: { number: '', location: '', date: '', costume: '', prop: '' },
};
