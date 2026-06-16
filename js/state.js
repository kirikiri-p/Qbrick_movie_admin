export const state = {
  movies: [],

  currentMovieId: null,
  currentSceneId: null,

  currentViewMode: 'list',
  currentSort: 'num-asc',
  showUnpreparedOnly: false,

  selectedSceneIds: new Set(),
  openedAccordionNames: new Set(),

  isEditorMode: false,

  globalCalYear: new Date().getFullYear(),
  globalCalMonth: new Date().getMonth(),

  renderedMovieId: null,
  renderedDailyDate: null,

  preSceneScroll: 0,
  restoreScrollPending: false,

  lastSearchFilters: { number: '', location: '', date: '', character: '', costume: '', prop: '' },
};
