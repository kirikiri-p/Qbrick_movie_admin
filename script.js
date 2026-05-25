import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAHgLjOMvSN88rLlLwNDrv4JQBGE-Bg6Ik",
  authDomain: "qbrick-movie-admin.firebaseapp.com",
  projectId: "qbrick-movie-admin",
  storageBucket: "qbrick-movie-admin.firebasestorage.app",
  messagingSenderId: "50401921198",
  appId: "1:50401921198:web:d53a5e16c2e82449ac853f",
  measurementId: "G-ZY07VHWJGG"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const moviesRef = collection(db, "movies");

let movies = [];
let currentMovieId = null;
let currentSceneId = null;
let currentViewMode = 'list'; 
let currentSort = 'num-asc'; 
let selectedSceneIds = new Set(); 
let lastViewHash = 'home'; 
let previousView = 'movie';

let renderedMovieId = null;
let renderedDailyDate = null;

let isEditorMode = false;
let globalCalYear = new Date().getFullYear();
let globalCalMonth = new Date().getMonth();

let lastSearchFilters = {
  number: '',
  location: '',
  date: '',
  costume: '',
  prop: ''
};

let isDarkMode = false;
document.addEventListener('DOMContentLoaded', () => {
  const darkModeBtn = document.getElementById('dark-mode-btn');
  if (darkModeBtn) {
    darkModeBtn.addEventListener('click', () => {
      isDarkMode = !isDarkMode;
      if (isDarkMode) {
        document.body.classList.add('dark-mode');
        darkModeBtn.textContent = '☀️';
      } else {
        document.body.classList.remove('dark-mode');
        darkModeBtn.textContent = '🌙';
      }
    });
  }

  const btnAddMovie = document.getElementById('btn-add-movie');
  if(btnAddMovie) btnAddMovie.addEventListener('click', addMovie);

  const btnSaveMovieDetails = document.getElementById('btn-save-movie-details');
  if(btnSaveMovieDetails) btnSaveMovieDetails.addEventListener('click', saveMovieDetails);

  const btnDeleteMovieDetails = document.getElementById('btn-delete-movie-details');
  if(btnDeleteMovieDetails) btnDeleteMovieDetails.addEventListener('click', deleteMovieFromDetails);
  
  const excelUpload = document.getElementById('excel-upload');
  if(excelUpload) excelUpload.addEventListener('change', handleExcelUpload);

  document.querySelectorAll('#search-number, #search-location, #search-date, #search-costume, #search-prop').forEach(el => {
    el.addEventListener('change', renderSearchResults);
  });
});

function migrateSceneData(scene) {
  if (scene.date && !scene.dates) { scene.dates = [scene.date]; } else if (!scene.dates) { scene.dates = []; }
  if (!scene.costumes) {
    scene.costumes = [];
    if (scene.costumeName) { scene.costumeName.split(',').forEach((n, i) => { if(n.trim()) scene.costumes.push({ id: 'c'+Date.now()+i, name: n.trim(), status: scene.costumeStatus||'未着手', desc: scene.costumeDesc||'', price: scene.costumePrice||'' }); }); }
  }
  if (!scene.props) {
    scene.props = [];
    if (scene.propName) { scene.propName.split(',').forEach((n, i) => { if(n.trim()) scene.props.push({ id: 'p'+Date.now()+i, name: n.trim(), status: scene.propStatus||'未着手', desc: scene.propDesc||'', price: scene.propPrice||'' }); }); }
  }
  if (!scene.memo) scene.memo = '';
  if (!scene.status) scene.status = '未撮影';
  return scene;
}

window.addEventListener('hashchange', (e) => {
  if (e.oldURL) {
    const oldHash = e.oldURL.split('#')[1];
    if (oldHash && !oldHash.startsWith('scene/')) {
      lastViewHash = oldHash;
    }
  }
  handleHash();
});

function handleHash(isDataUpdate = false) {
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
    executeGoSearch(parseInt(hash.split('/')[1]), isDataUpdate);
  } else if (hash.startsWith('details/')) {
    executeGoMovieDetails(parseInt(hash.split('/')[1]), isDataUpdate);
  }
}

let isInitialLoad = true;
onSnapshot(moviesRef, (snapshot) => {
  movies = [];
  snapshot.forEach((doc) => {
    let data = doc.data();
    data.scenes = data.scenes.map(migrateSceneData); 
    movies.push(data);
  });
  
  if (isInitialLoad) {
    isInitialLoad = false;
    handleHash();
  } else {
    handleHash(true);
  }
});

window.goHome = () => { window.location.hash = 'home'; };
window.goMovie = (id) => { window.location.hash = 'movie/' + id; };
window.goSearch = () => { window.location.hash = 'search/' + currentMovieId; };
window.goMovieDetails = (id) => { window.location.hash = 'details/' + id; };
window.showDailyScenes = (dateStr) => { window.location.hash = `daily/${dateStr}`; };

window.goScene = (sId, forceMovieId) => {
  const currentHash = window.location.hash.replace('#', '');
  
  if (currentHash.startsWith('search/')) {
    previousView = 'search';
    currentMovieId = forceMovieId || currentMovieId;
    currentSceneId = sId;

    lastSearchFilters.number = document.getElementById('search-number')?.value || '';
    lastSearchFilters.location = document.getElementById('search-location')?.value || '';
    lastSearchFilters.date = document.getElementById('search-date')?.value || '';
    lastSearchFilters.costume = document.getElementById('search-costume')?.value || '';
    lastSearchFilters.prop = document.getElementById('search-prop')?.value || '';

    executeGoScene(sId, currentMovieId, null, false);
    return;
  }

  if (currentHash.startsWith('daily/')) {
    previousView = 'daily';
  } else {
    previousView = 'movie';
  }

  if (currentHash.startsWith('daily/')) {
    const dateStr = currentHash.split('/')[1];
    window.location.hash = `daily/${dateStr}/scene/${forceMovieId || currentMovieId}/${sId}`;
  } else {
    window.location.hash = `movie/${forceMovieId || currentMovieId}/scene/${sId}`;
  }
};

window.backFromSearch = () => { window.location.hash = `movie/${currentMovieId}`; };

window.closeSceneDetail = () => {
  const detailPane = document.getElementById('detail-pane');
  detailPane.classList.remove('show-detail');
  currentSceneId = null;
  document.body.style.overflow = '';

  const currentHash = window.location.hash.replace('#', '');

  if (currentHash.startsWith('daily/')) {
    const dateStr = currentHash.split('/')[1];
    window.location.hash = `daily/${dateStr}`;
  } 
  else if (previousView === 'search') {
    executeGoSearch(currentMovieId, false, true); // preserveFilters = true
    setTimeout(() => {
      restoreSearchFilters();
    }, 40);
    previousView = 'movie';
  } 
  else {
    window.location.hash = `movie/${currentMovieId}`;
    previousView = 'movie';
  }
};

function restoreSearchFilters() {
  const numSel = document.getElementById('search-number');
  const locSel = document.getElementById('search-location');
  const dateSel = document.getElementById('search-date');
  const cosSel = document.getElementById('search-costume');
  const propSel = document.getElementById('search-prop');

  if (numSel) numSel.value = lastSearchFilters.number || '';
  if (locSel) locSel.value = lastSearchFilters.location || '';
  if (dateSel) dateSel.value = lastSearchFilters.date || '';
  if (cosSel) cosSel.value = lastSearchFilters.costume || '';
  if (propSel) propSel.value = lastSearchFilters.prop || '';

  renderSearchResults();
}

function executeGoHome(isDataUpdate) {
  document.body.style.overflow = '';
  currentMovieId = null;
  renderHome(); 
  document.getElementById('header-movie-title-nav').classList.add('hidden');
  document.getElementById('header-main-title').textContent = '製作映画一覧';
  showViewUI('view-home'); 
}

function executeGoMovie(mId, isDataUpdate) {
  document.body.style.overflow = '';
  currentMovieId = mId; 
  selectedSceneIds.clear();
  document.getElementById('bulk-delete-btn').classList.add('hidden');
  
  const movie = movies.find(m => m.id === currentMovieId);
  if(!movie) return;
  document.getElementById('header-movie-title-nav').classList.remove('hidden');
  document.getElementById('header-title-sub').textContent = movie.title;
  document.getElementById('header-main-title').textContent = movie.title;
  
  if(!isDataUpdate && renderedMovieId !== currentMovieId) {
    document.getElementById('new-scene-dates').innerHTML = '';
    window.addDateInput('new-scene-dates');
    setViewMode('list');
    populateSearchFilters();
    renderMovie();
  } else if (isDataUpdate) {
    populateSearchFilters();
    renderMovie();
  }
  
  document.getElementById('detail-pane').classList.remove('show-detail');
  currentSceneId = null;
  showViewUI('view-movie'); 
}

function executeGoScene(sId, mId, dailyDateStr, isDataUpdate) {
  currentMovieId = mId;
  currentSceneId = sId;
  const movie = movies.find(m => m.id === currentMovieId);
  if (!movie) return;

  const detailPane = document.getElementById('detail-pane');

  if (dailyDateStr) {
    document.getElementById('header-movie-title-nav').classList.remove('hidden');
    document.getElementById('header-title-sub').textContent = `${dailyDateStr} の予定`;
    document.getElementById('daily-detail-container').appendChild(detailPane);
    if (!isDataUpdate && renderedDailyDate !== dailyDateStr) {
      executeGoDaily(dailyDateStr, false, true);
    }
    showViewUI('view-daily');
  } else {
    document.getElementById('header-movie-title-nav').classList.remove('hidden');
    document.getElementById('header-title-sub').textContent = movie.title;
    document.getElementById('movie-detail-container').appendChild(detailPane);

    if (!isDataUpdate && renderedMovieId !== currentMovieId) {
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
  if (window.innerWidth < 800) {
    document.body.style.overflow = 'hidden';
  }
}

function executeGoSearch(mId, isDataUpdate = false, preserveFilters = false) {
  document.body.style.overflow = '';
  currentMovieId = mId;
  populateSearchFilters();

  if (!isDataUpdate && !preserveFilters) {
    clearSearch(false);
  }

  renderSearchResults();
  showViewUI('view-search');
}

function executeGoMovieDetails(mId, isDataUpdate) {
  document.body.style.overflow = '';
  currentMovieId = mId;
  const movie = movies.find(m => m.id === currentMovieId);
  if(!movie) return;
  if(!isDataUpdate) {
    document.getElementById('movie-detail-title').value = movie.title || '';
    document.getElementById('movie-detail-icon').value = movie.icon || '';
    document.getElementById('movie-detail-type').value = movie.type || '';
    document.getElementById('movie-detail-director').value = movie.director || '';
    document.getElementById('movie-detail-year').value = movie.year || '';
  }
  showViewUI('view-movie-details');
}

function executeGoDaily(dateStr, isDataUpdate, skipRenderIfLoaded = false) {
  document.body.style.overflow = '';
  renderedDailyDate = dateStr;
  document.getElementById('header-movie-title-nav').classList.remove('hidden');
  document.getElementById('header-title-sub').textContent = `${dateStr} の予定`;
  document.getElementById('header-main-title').textContent = `${dateStr} の撮影予定`;
  document.getElementById('daily-date-title').textContent = `${dateStr} の撮影予定`;
  
  const container = document.getElementById('daily-scene-list-container');
  
  if (skipRenderIfLoaded && container.children.length > 0) {
  } else {
    container.innerHTML = '';
    let activeScenes = [];
    movies.forEach(m => {
      if(getParticipation(m.id)) m.scenes.forEach(s => activeScenes.push({ movie: m, scene: s }));
    });
    
    const dayScenes = activeScenes.filter(item => item.scene.dates && (item.scene.dates.includes(dateStr) || item.scene.dates.includes(dateStr.replace(/-0/g, '-')))); 
    
    dayScenes.sort((a, b) => String(a.scene.number).localeCompare(String(b.scene.number), undefined, {numeric: true, sensitivity: 'base'})).forEach(item => {
      const card = createSceneCard(item.scene, item.movie.id);
      const titleObj = document.createElement('div');
      const icon = item.movie.icon || '🎬';
      titleObj.innerHTML = `<strong style="color: #1976d2; font-size: 14px;">${icon} 映画: ${item.movie.title}</strong><hr style="border:0; border-top:1px dashed #ccc; margin: 4px 0;">`;
      card.prepend(titleObj);
      container.appendChild(card);
    });
  }
  showViewUI('view-daily');
}

function showViewUI(viewId) {
  ['view-home', 'view-movie', 'view-daily', 'view-search', 'view-movie-details'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.classList.add('hidden');
  });
  document.getElementById(viewId).classList.remove('hidden');
  if(viewId === 'view-movie' || viewId === 'view-search') {
    document.getElementById('header-search-btn').classList.remove('hidden');
  } else {
    document.getElementById('header-search-btn').classList.add('hidden');
  }
}

window.toggleEditorMode = function() {
  if (isEditorMode) {
    isEditorMode = false;
    document.body.classList.remove('editor-mode');
    document.getElementById('editor-toggle-btn').textContent = '編集者モードになる';
    selectedSceneIds.clear();
    const bulkBtn = document.getElementById('bulk-delete-btn');
    if(bulkBtn) bulkBtn.classList.add('hidden');
    alert('閲覧モードに戻りました');
  } else {
    const pass = prompt('編集者用パスワードを入力してください');
    if (pass === 'きゅーぶりっく') {
      isEditorMode = true;
      document.body.classList.add('editor-mode');
      document.getElementById('editor-toggle-btn').textContent = '閲覧モードに戻る';
      alert('編集者モードに切り替わりました');
    } else if (pass !== null) {
      alert('パスワードが違います');
    }
  }
  renderHome();
  if (currentMovieId) renderMovie();
};

async function saveMovie(movie) { await setDoc(doc(db, "movies", movie.id.toString()), movie); }

window.saveMovieDetails = function() {
  const movie = movies.find(m => m.id === currentMovieId);
  movie.title = document.getElementById('movie-detail-title').value.trim();
  movie.icon = document.getElementById('movie-detail-icon').value.trim();
  movie.type = document.getElementById('movie-detail-type').value;
  movie.director = document.getElementById('movie-detail-director').value.trim();
  movie.year = document.getElementById('movie-detail-year').value.trim();
  if(!movie.title) { alert('タイトルは必須です'); return; }
  saveMovie(movie);
  window.goHome();
};

window.deleteMovieFromDetails = async function() {
  const movie = movies.find(m => m.id === currentMovieId);
  if(confirm(`映画「${movie.title}」を本当に削除しますか？`)) {
    await deleteDoc(doc(db, "movies", currentMovieId.toString()));
    window.goHome();
  }
};

function getParticipation(movieId) { return localStorage.getItem('part_' + movieId) === 'true'; }
window.toggleParticipation = function(movieId) {
  const current = getParticipation(movieId);
  localStorage.setItem('part_' + movieId, current ? 'false' : 'true');
  renderHome(); 
};

window.addDateInput = function(containerId, initDate = null) {
  const container = document.getElementById(containerId);
  const div = document.createElement('div');
  div.style = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;';
  div.innerHTML = `
    <input type="date" class="native-date-input" value="${initDate || ''}" onchange="checkSceneInput()">
    <button type="button" class="item-remove-btn" style="position:static; padding:4px 8px;" onclick="this.parentElement.remove(); checkSceneInput();" title="消す">✕</button>
  `;
  container.appendChild(div);
};

function collectDatesFromContainer(containerId) {
  const dates = [];
  document.getElementById(containerId).querySelectorAll('.native-date-input').forEach(input => {
    if(input.value) dates.push(input.value);
  });
  return dates;
}

window.updateSelectColor = function(sel) {
  sel.classList.remove('status-未着手', 'status-準備中', 'status-準備完了', 'status-使用済み');
  sel.classList.add('status-' + sel.value);
};

function parseExcelDate(serial) {
  if (!serial) return '';
  if (typeof serial === 'number') {
    const utc_days = Math.floor(serial - 25569);
    const date_info = new Date(utc_days * 86400 * 1000);
    return date_info.getUTCFullYear() + '-' + ('0' + (date_info.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + date_info.getUTCDate()).slice(-2);
  }
  return String(serial);
}

window.scrollToTop = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); };

window.openSceneEdit = function() {
  document.getElementById('detail-pane-view').classList.add('hidden');
  document.getElementById('detail-pane-edit').classList.remove('hidden');
  renderSceneEditDetail();
};

window.cancelSceneEdit = function() {
  document.getElementById('detail-pane-edit').classList.add('hidden');
  document.getElementById('detail-pane-view').classList.remove('hidden');
};

window.addMovie = function() {
  const titleInput = document.getElementById('new-movie-title');
  const title = titleInput.value.trim();
  if (!title) return;
  const newMovie = { id: Date.now(), title: title, scenes: [], type: '', director: '', year: '', icon: '🎬' };
  saveMovie(newMovie); 
  titleInput.value = '';
};

window.handleExcelUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, {type: 'array'});
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, {header: 1});
    const rows = json.slice(1);
    const newScenes = [];
    
    rows.forEach((row, index) => {
      if (!row || row.length === 0) return;
      const number = String(row[0] || '');
      const rawDate = parseExcelDate(row[1]);
      const dates = rawDate ? String(rawDate).split(',').map(d=>d.trim()).filter(d=>d) : [];
      const sceneName = String(row[2] || '');
      const location = String(row[3] || '');
      
      const cStats = row[4] ? String(row[4]).split(',') : [];
      const cNames = row[5] ? String(row[5]).split(',') : [];
      const cDescs = row[6] ? String(row[6]).split(',') : [];
      const cPrices = row[7] ? String(row[7]).split(',') : [];
      const costumes = cNames.map((n, i) => ({
        id: 'c'+Date.now()+i+Math.random(), name: n.trim(), status: (cStats[i] || '未着手').trim(), desc: (cDescs[i] || '').trim(), price: (cPrices[i] || '').trim()
      })).filter(c => c.name);

      const pStats = row[8] ? String(row[8]).split(',') : [];
      const pNames = row[9] ? String(row[9]).split(',') : [];
      const pDescs = row[10] ? String(row[10]).split(',') : [];
      const pPrices = row[11] ? String(row[11]).split(',') : [];
      const props = pNames.map((n, i) => ({
        id: 'p'+Date.now()+i+Math.random(), name: n.trim(), status: (pStats[i] || '未着手').trim(), desc: (pDescs[i] || '').trim(), price: (pPrices[i] || '').trim()
      })).filter(p => p.name);

      const existing = newScenes.find(s => s.number === number && s.sceneName === sceneName && s.location === location);
      if (existing) {
        if(costumes.length > 0) existing.costumes.push(...costumes);
        if(props.length > 0) existing.props.push(...props);
        dates.forEach(d => { if(!existing.dates.includes(d)) existing.dates.push(d); });
      } else {
        newScenes.push({ id: Date.now() + index, number: number, dates: dates, sceneName: sceneName, location: location, costumes: costumes, props: props });
      }
    });

    const movieTitle = file.name.replace(/\.[^/.]+$/, "");
    const newMovie = { id: Date.now(), title: movieTitle, scenes: newScenes, type: '', director: '', year: '', icon: '🎬' };
    saveMovie(newMovie); 
    document.getElementById('excel-upload').value = '';
    alert(movieTitle + ' のデータを読み込みました');
  };
  reader.readAsArrayBuffer(file);
};

window.exportToExcel = function() {
  const movie = movies.find(m => m.id === currentMovieId);
  if(!movie) return;
  const aoa = [['シーン番号', '撮影日', 'シーン名', '場所', '衣装ステータス', '衣装名', '衣装詳細', '金額/メモ', '小道具ステータス', '物品名', '小道具詳細', '金額/メモ']];
  
  movie.scenes.forEach(s => {
    const dateStr = s.dates ? s.dates.join(',') : '';
    const cStats = (s.costumes||[]).map(c=>c.status).join(',');
    const cNames = (s.costumes||[]).map(c=>c.name).join(',');
    const cDescs = (s.costumes||[]).map(c=>c.desc).join(',');
    const cPrices = (s.costumes||[]).map(c=>c.price).join(',');
    const pStats = (s.props||[]).map(p=>p.status).join(',');
    const pNames = (s.props||[]).map(p=>p.name).join(',');
    const pDescs = (s.props||[]).map(p=>p.desc).join(',');
    const pPrices = (s.props||[]).map(p=>p.price).join(',');

    aoa.push([s.number, dateStr, s.sceneName, s.location, cStats, cNames, cDescs, cPrices, pStats, pNames, pDescs, pPrices]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Scenes");
  XLSX.writeFile(wb, `${movie.title}_シーン一覧.xlsx`);
};

function getSceneOverallStatus(scene) {
  const items = [...(scene.costumes || []), ...(scene.props || [])];
  if(items.length === 0) return 'none'; 
  let hasAlert = false, allUsed = true, allReadyOrUsed = true;
  items.forEach(i => {
    if(i.status === '未着手' || i.status === '準備中') hasAlert = true;
    if(i.status !== '使用済み') allUsed = false;
    if(i.status !== '準備完了' && i.status !== '使用済み') allReadyOrUsed = false;
  });
  if(hasAlert) return 'alert';       
  if(allUsed) return 'used';         
  if(allReadyOrUsed) return 'ready'; 
  return 'none';
}

function renderGlobalCalendar() {
  const container = document.getElementById('global-calendar');
  container.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'cal-header';
  header.innerHTML = `
    <button onclick="changeGlobalCalMonth(-1)">&lt; 前月</button>
    <strong>${globalCalYear}年 ${globalCalMonth + 1}月</strong>
    <button onclick="changeGlobalCalMonth(1)">次月 &gt;</button>
  `;
  container.appendChild(header);

  const table = document.createElement('table');
  table.className = 'calendar-table';
  table.innerHTML = '<tr><th>日</th><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th><th>土</th></tr>';
  
  const firstDay = new Date(globalCalYear, globalCalMonth, 1).getDay();
  const daysInMonth = new Date(globalCalYear, globalCalMonth + 1, 0).getDate();
  
  let tr = document.createElement('tr');
  for(let i = 0; i < firstDay; i++) tr.appendChild(document.createElement('td'));
  
  let activeScenes = [];
  movies.forEach(m => {
    if(getParticipation(m.id)) m.scenes.forEach(s => activeScenes.push({ movie: m, scene: s }));
  });

  for(let day = 1; day <= daysInMonth; day++) {
    if(tr.children.length === 7) { table.appendChild(tr); tr = document.createElement('tr'); }
    const td = document.createElement('td');
    
    const dateStr = `${globalCalYear}-${('0'+(globalCalMonth+1)).slice(-2)}-${('0'+day).slice(-2)}`;
    const dayScenes = activeScenes.filter(item => item.scene.dates && (item.scene.dates.includes(dateStr) || item.scene.dates.includes(dateStr.replace(/-0/g, '-')))); 
    
    if(dayScenes.length > 0) {
      td.style.cursor = 'pointer';
      td.style.backgroundColor = 'rgba(25, 118, 210, 0.05)';
      td.onclick = () => window.showDailyScenes(dateStr);
      
      const icons = new Set();
      dayScenes.forEach(item => icons.add(item.movie.icon || '🎬'));
      
      td.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="cal-day-num">${day}</span>
        <span style="font-size:12px;">${Array.from(icons).join('')}</span>
      </div>`;
      
      const dotContainer = document.createElement('div');
      dotContainer.style = 'display:flex; flex-wrap:wrap; gap:4px; justify-content:flex-start; margin-top:4px;';

      dayScenes.forEach(item => {
        const overall = getSceneOverallStatus(item.scene);
        const dot = document.createElement('span');
        dot.className = `cal-status-circle cal-bg-${overall}`;
        dotContainer.appendChild(dot);
      });
      td.appendChild(dotContainer);
    } else {
      td.innerHTML = `<span class="cal-day-num">${day}</span>`;
    }
    tr.appendChild(td);
  }
  while(tr.children.length < 7) tr.appendChild(document.createElement('td'));
  table.appendChild(tr);
  container.appendChild(table);
}

window.changeGlobalCalMonth = function(diff) {
  globalCalMonth += diff;
  if(globalCalMonth < 0) { globalCalMonth = 11; globalCalYear--; }
  if(globalCalMonth > 11) { globalCalMonth = 0; globalCalYear++; }
  renderHome();
};

function renderHome() {
  renderGlobalCalendar(); 
  const list = document.getElementById('movie-list');
  list.innerHTML = '';
  if(movies.length === 0) {
    list.innerHTML = '<p class="scene-info">まだ登録された映画がありません</p>';
    return;
  }
  movies.forEach(movie => {
    const div = document.createElement('div');
    div.className = 'card movie-list-item';
    
    const isPart = getParticipation(movie.id); 
    const toggleText = isPart ? '参加' : '非参加';
    let detailText = `${movie.scenes.length}件のシーン`;
    if(movie.director) detailText += ` ｜ 監督: ${movie.director}`;
    if(movie.year) detailText += ` ｜ ${movie.year}年`;
    let editBtnHtml = isEditorMode ? `<button class="edit-title-btn" onclick="event.stopPropagation(); window.goMovieDetails(${movie.id})">編集</button>` : '';
    const icon = movie.icon || '🎬';

    div.innerHTML = `
      <div class="movie-info" onclick="window.goMovie(${movie.id})">
        <strong>${icon} ${movie.type ? `[${movie.type}] ` : ''}${movie.title}</strong>
        <div class="scene-info" style="margin-left: 12px; margin-top: 0;">${detailText}</div>
      </div>
      <div class="movie-actions">
        <label class="switch-container" onclick="event.stopPropagation();">
          <span class="switch-label">${toggleText}</span>
          <div class="switch">
            <input type="checkbox" ${isPart ? 'checked' : ''} onchange="window.toggleParticipation(${movie.id})">
            <span class="slider"></span>
          </div>
        </label>
        ${editBtnHtml}
      </div>
    `;
    list.appendChild(div);
  });
}

window.checkSceneInput = function() {
  const num = document.getElementById('new-scene-number').value.trim();
  const btn = document.getElementById('add-scene-btn');
  btn.disabled = (num === '');
};

function createItemInputHTML(type, item = null) {
  const id = item ? item.id : Date.now() + Math.random().toString(36).substring(2,7);
  const status = item ? item.status : '未着手';
  const name = item ? item.name : '';
  const desc = item ? item.desc : '';
  const price = item ? item.price : '';
  
  const div = document.createElement('div');
  div.className = 'item-input-block';
  div.dataset.id = id;
  
  div.innerHTML = `
    <button type="button" class="item-remove-btn" onclick="this.closest('.item-input-block').remove()" title="この枠を消す">✕</button>
    <select class="item-status status-color status-${status}" onchange="updateSelectColor(this)">
      <option value="未着手" ${status==='未着手'?'selected':''}>未着手</option>
      <option value="準備中" ${status==='準備中'?'selected':''}>準備中</option>
      <option value="準備完了" ${status==='準備完了'?'selected':''}>準備完了</option>
    </select>
    
    <div style="margin-bottom: 4px; font-weight: bold; font-size: 12px; color: var(--muted-text); margin-top: 8px;">${type==='costume'?'衣装名':'小道具名'}</div>
    <input type="text" class="item-name" placeholder="${type==='costume'?'例: スーツ':'例: スマホ'}" value="${name}" oninput="showSuggestions(this, '${type}')">
    <div class="suggestion-container"></div>
    
    <div style="margin-bottom: 4px; font-weight: bold; font-size: 12px; color: var(--muted-text); margin-top: 8px;">${type==='costume'?'衣装詳細':'小道具詳細'}</div>
    <textarea class="item-desc" placeholder="${type==='costume'?'例: ○○さんの私物':'例: なるべく小さいもの'}">${desc}</textarea>
    
    <div style="margin-bottom: 4px; font-weight: bold; font-size: 12px; color: var(--muted-text); margin-top: 8px;">金額/メモ</div>
    <input type="text" class="item-price" placeholder="例: 1500円" value="${price}">
  `;
  return div;
}

window.addCostumeInput = function(containerId, item = null) { document.getElementById(containerId).appendChild(createItemInputHTML('costume', item)); };
window.addPropInput = function(containerId, item = null) { document.getElementById(containerId).appendChild(createItemInputHTML('prop', item)); };

window.showSuggestions = function(inputElem, type) {
  const name = inputElem.value.trim();
  const block = inputElem.closest('.item-input-block');
  const suggestionContainer = block.querySelector('.suggestion-container');
  suggestionContainer.innerHTML = '';
  
  if(!name || !currentMovieId) return;
  const movie = movies.find(m => m.id === currentMovieId);
  if(!movie) return;
  
  const candidates = [];
  const seen = new Set();
  
  movie.scenes.forEach(s => {
    const items = (type === 'costume' ? s.costumes : s.props) || [];
    items.forEach(i => {
      if(i.name.includes(name) && (i.desc || i.price || i.status)) {
        const key = i.name + '|' + i.desc + '|' + i.price + '|' + i.status;
        if(!seen.has(key)) {
          seen.add(key);
          candidates.push(i);
        }
      }
    });
  });
  
  candidates.slice(0, 5).forEach(c => {
    const chip = document.createElement('div');
    chip.className = 'suggestion-chip';
    chip.textContent = `${c.name} ${c.desc ? `(${c.desc.substring(0, 8)}...)` : ''}`;
    chip.onclick = () => {
      inputElem.value = c.name;
      const descInput = block.querySelector('.item-desc');
      const priceInput = block.querySelector('.item-price');
      const statusInput = block.querySelector('.item-status');
      if(descInput) descInput.value = c.desc;
      if(priceInput) priceInput.value = c.price;
      if(statusInput && c.status) {
        statusInput.value = c.status;
        window.updateSelectColor(statusInput);
      }
      suggestionContainer.innerHTML = ''; 
    };
    suggestionContainer.appendChild(chip);
  });
};

function collectItemsFromDOM(containerId) {
  const items = [];
  document.querySelectorAll(`#${containerId} .item-input-block`).forEach(block => {
    const name = block.querySelector('.item-name').value.trim();
    if(name) {
      items.push({
        id: block.dataset.id,
        status: block.querySelector('.item-status').value,
        name: name,
        desc: block.querySelector('.item-desc').value,
        price: block.querySelector('.item-price').value
      });
    }
  });
  return items;
}

function syncItemStatuses(movie, updatedItems, typeKey) {
  updatedItems.forEach(updatedItem => {
    movie.scenes.forEach(scene => {
      const items = scene[typeKey] || [];
      items.forEach(item => {
        if (item.name === updatedItem.name) {
          item.status = updatedItem.status;
        }
      });
    });
  });
}

window.addScene = function() {
  const num = document.getElementById('new-scene-number').value.trim();
  const name = document.getElementById('new-scene-name').value.trim();
  const loc = document.getElementById('new-scene-location').value.trim();
  const dates = collectDatesFromContainer('new-scene-dates');

  const movie = movies.find(m => m.id === currentMovieId);
  const newCostumes = collectItemsFromDOM('new-costume-list');
  const newProps = collectItemsFromDOM('new-prop-list');

  movie.scenes.push({
    id: Date.now(), number: num, sceneName: name, location: loc, memo: memo, dates: dates,
    costumes: newCostumes, props: newProps
  });

  syncItemStatuses(movie, newCostumes, 'costumes');
  syncItemStatuses(movie, newProps, 'props');

  saveMovie(movie); 
  
  document.getElementById('new-scene-number').value = '';
  document.getElementById('new-scene-name').value = '';
  document.getElementById('new-scene-location').value = '';
  document.getElementById('new-scene-dates').innerHTML = '';
  window.addDateInput('new-scene-dates'); 
  
  document.getElementById('new-costume-list').innerHTML = '';
  document.getElementById('new-prop-list').innerHTML = '';
  document.getElementById('new-scene-details').removeAttribute('open');
  
  window.checkSceneInput();
};

window.toggleSceneSelection = function(sceneId, checkbox, event) {
  event.stopPropagation();
  if(checkbox.checked) selectedSceneIds.add(sceneId);
  else selectedSceneIds.delete(sceneId);
  
  const btn = document.getElementById('bulk-delete-btn');
  if(selectedSceneIds.size > 0 && isEditorMode) btn.classList.remove('hidden');
  else btn.classList.add('hidden');
  
  const card = checkbox.closest('.card');
  if(checkbox.checked) card.classList.add('selected-card');
  else card.classList.remove('selected-card');
};

window.deleteSelectedScenes = function() {
  if(confirm(`${selectedSceneIds.size}件のシーンを削除しますか？`)) {
    const movie = movies.find(m => m.id === currentMovieId);
    movie.scenes = movie.scenes.filter(s => !selectedSceneIds.has(s.id));
    selectedSceneIds.clear();
    document.getElementById('bulk-delete-btn').classList.add('hidden');
    saveMovie(movie);
  }
};

window.deleteScene = function() {
  if(!currentSceneId) return;
  if(confirm("本当にこのシーンを削除してもよろしいですか？")) {
    const movie = movies.find(m => m.id === currentMovieId);
    movie.scenes = movie.scenes.filter(s => s.id !== currentSceneId);
    saveMovie(movie); 
    window.closeSceneDetail(); 
  }
};

window.clearSearch = function(doRender = true) {
  ['number', 'location', 'date', 'costume', 'prop'].forEach(id => {
    document.getElementById('search-' + id).value = '';
  });
  if(doRender) window.renderSearchResults();
};

function getUniqueProperties(movie, propName) {
  const items = new Set();
  movie.scenes.forEach(s => {
    if (propName === 'dates') {
      if(s.dates && s.dates.length > 0) s.dates.forEach(d => items.add(d));
      else items.add('未定');
    } else {
      if(s[propName]) items.add(s[propName]);
      else if(propName === 'location') items.add('未定');
    }
  });
  let arr = Array.from(items);
  if (propName === 'number') {
    arr.sort((a, b) => String(a).localeCompare(String(b), undefined, {numeric: true, sensitivity: 'base'}));
  } else {
    arr.sort();
  }
  return arr;
}

function getUniqueItemNames(movie, typeKey) {
  const names = new Set();
  movie.scenes.forEach(s => {
    const items = (typeKey === 'costumes' ? s.costumes : s.props) || [];
    items.forEach(item => names.add(item.name));
  });
  return Array.from(names).sort();
}

function populateSearchFilters() {
  const movie = movies.find(m => m.id === currentMovieId);
  if(!movie) return;

  const numSel = document.getElementById('search-number');
  const locSel = document.getElementById('search-location');
  const dateSel = document.getElementById('search-date');
  const cosSel = document.getElementById('search-costume');
  const propSel = document.getElementById('search-prop');

  [numSel, locSel, dateSel, cosSel, propSel].forEach(s => {
    const currentVal = s.value;
    s.innerHTML = '<option value="">すべて</option>';
    s.dataset.current = currentVal;
  });

  getUniqueProperties(movie, 'number').forEach(v => numSel.add(new Option(v, v)));
  getUniqueProperties(movie, 'location').forEach(v => locSel.add(new Option(v, v)));
  getUniqueProperties(movie, 'dates').forEach(v => dateSel.add(new Option(v, v)));
  getUniqueItemNames(movie, 'costumes').forEach(v => cosSel.add(new Option(v, v)));
  getUniqueItemNames(movie, 'props').forEach(v => propSel.add(new Option(v, v)));

  [numSel, locSel, dateSel, cosSel, propSel].forEach(s => {
    if(s.dataset.current) s.value = s.dataset.current;
  });
}

window.setViewMode = function(mode) {
  currentViewMode = mode;
  ['list', 'cos', 'prop'].forEach(id => {
    document.getElementById('btn-view-' + id).classList.remove('active');
  });
  document.getElementById('btn-view-' + mode).classList.add('active');
  
  const sortSel = document.getElementById('sort-select');
  sortSel.innerHTML = '';
  if(mode === 'list') {
    sortSel.add(new Option('番号順 (昇順)', 'num-asc'));
    sortSel.add(new Option('番号順 (降順)', 'num-desc'));
    sortSel.add(new Option('撮影日が早い順', 'date-asc'));
    sortSel.add(new Option('撮影日が遅い順', 'date-desc'));
    currentSort = 'num-asc';
    sortSel.value = 'num-asc';
  } else {
    sortSel.add(new Option('使用シーンが多い順', 'count-desc')); 
    sortSel.add(new Option('名前順', 'name-asc'));
    sortSel.add(new Option('最速使用日が早い順', 'date-asc'));
    currentSort = 'count-desc';
    sortSel.value = 'count-desc';
  }
  
  renderMovie();
};

window.updateSort = function(val) { currentSort = val; renderMovie(); };

function createSceneCard(scene, forceMovieId = null) {
  const div = document.createElement('div');
  div.className = 'card';
  if(scene.id === currentSceneId) div.style.border = '2px solid var(--accent-color)';
  if(selectedSceneIds.has(scene.id)) div.classList.add('selected-card');

  let borderStatus = getSceneOverallStatus(scene);
  if (scene.status === '撮影済み') {
    borderStatus = 'used';
  }
  div.classList.add(`scene-border-${borderStatus}`);

  let html = `<div class="scene-card-header">`;

  if (!forceMovieId && isEditorMode) {
  const isShot = scene.status === '撮影済み';
  html += `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
      <input type="checkbox" class="scene-checkbox" 
             ${selectedSceneIds.has(scene.id) ? 'checked' : ''} 
             onclick="window.toggleSceneSelection(${scene.id}, this, event)">
      
      <label class="switch-container" style="margin-left:auto; margin-bottom:0;" 
             onclick="event.stopPropagation();">
        <span class="switch-label" style="font-size:11px; min-width:auto;">${isShot ? '撮影済み' : '未撮影'}</span>
        <div class="switch" style="width:36px; height:20px;">
          <input type="checkbox" ${isShot ? 'checked' : ''} 
                 onchange="window.toggleSceneShotStatus(${scene.id}, this, ${forceMovieId ?? 'null'}, event)">
          <span class="slider"></span>
        </div>
      </label>
    </div>
  `;
}
  else if (!forceMovieId && isEditorMode === false && scene.status === '撮影済み') {
    html += `<div style="text-align:right; margin-bottom:4px;">
      <span class="status-color status-使用済み" style="font-size:11px; padding:1px 6px;">撮影済み</span>
    </div>`;
  }

  html += `<div class="scene-content">`;
  html += `<strong>シーン ${scene.number}</strong>`;
  if(scene.sceneName) html += ` ｜ ${scene.sceneName}`;
  if(scene.location) html += ` ｜ ${scene.location}`;
  
  let dateText = '未定';
  if (scene.dates && scene.dates.length > 0) {
    dateText = scene.dates.join(', ');
  }
  html += `<div class="scene-info">撮影日: ${dateText}</div>`;
  
  html += `<div style="margin-top: 8px;">`;
  if(scene.costumes && scene.costumes.length > 0) {
    scene.costumes.forEach(c => html += `<span class="item-badge status-${c.status}">${c.name}</span>`);
    html += `<br>`;
  }
  if(scene.props && scene.props.length > 0) {
    scene.props.forEach(p => html += `<span class="item-badge status-${p.status}">${p.name}</span>`);
  }
  html += `</div></div></div>`;
  
  div.innerHTML = html;
  div.onclick = () => window.goScene(scene.id, forceMovieId);
  return div;
}

function getEarliestDate(movie, typeKey, itemName) {
  const scenes = movie.scenes.filter(s => {
    const items = (typeKey === 'costumes' ? s.costumes : s.props) || [];
    return items.some(i => i.name === itemName) && s.dates && s.dates.length > 0;
  });
  if(scenes.length === 0) return null;
  const allDates = scenes.flatMap(s => s.dates).sort();
  return allDates[0];
}

function renderInventory(movie, listContainer, typeKey) {
  let uniqueNames = getUniqueItemNames(movie, typeKey);
  
  if(uniqueNames.length === 0) {
    listContainer.innerHTML = '<p class="scene-info">まだ登録されていません</p>';
    return;
  }

  uniqueNames.sort((a, b) => {
    if(currentSort === 'name-asc') return a.localeCompare(b);
    if(currentSort === 'date-asc') {
      let dateA = getEarliestDate(movie, typeKey, a);
      let dateB = getEarliestDate(movie, typeKey, b);
      if(!dateA && !dateB) return 0; 
      if(!dateA) return 1;           
      if(!dateB) return -1;          
      return dateA.localeCompare(dateB);
    }
    if(currentSort === 'count-desc') {
      const countA = movie.scenes.filter(s => ((typeKey === 'costumes' ? s.costumes : s.props) || []).some(i => i.name === a)).length;
      const countB = movie.scenes.filter(s => ((typeKey === 'costumes' ? s.costumes : s.props) || []).some(i => i.name === b)).length;
      return countB - countA;
    }
    return 0;
  });

  uniqueNames.forEach(name => {
    const matchingScenes = movie.scenes.filter(s => {
      const items = (typeKey === 'costumes' ? s.costumes : s.props) || [];
      return items.some(i => i.name === name);
    });
    
    let itemStatuses = new Set();
    matchingScenes.forEach(s => {
      const items = (typeKey === 'costumes' ? s.costumes : s.props) || [];
      items.filter(i => i.name === name).forEach(i => itemStatuses.add(i.status));
    });
    let statusHtml = '';
    if(itemStatuses.size === 1) {
      const st = Array.from(itemStatuses)[0];
      statusHtml = `<span class="inventory-status-badge status-color status-${st}">${st}</span>`;
    }

    const details = document.createElement('details');
    details.className = 'accordion inventory-accordion';
    
    const summary = document.createElement('summary');
    summary.innerHTML = `
      <div style="display:flex; align-items:flex-start; width:100%;">
        <div style="flex-shrink:0; margin-top:2px;">${statusHtml}</div>
        <div style="flex:1; word-break:break-all; line-height:1.4;">${name}</div>
        <div style="flex-shrink:0; white-space:nowrap; margin-left:8px; font-weight:normal; font-size:12px; color:var(--muted-text);">(${matchingScenes.length}件)</div>
      </div>
    `;
    details.appendChild(summary);

    const content = document.createElement('div');
    content.className = 'accordion-content';
    
    matchingScenes.sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, {numeric: true, sensitivity: 'base'})).forEach(scene => {
      content.appendChild(createSceneCard(scene));
    });
    
    details.appendChild(content);
    listContainer.appendChild(details);
  });
}

window.toggleSceneShotStatus = async function(sceneId, checkbox, forceMovieId, event) {
  event.stopPropagation();

  let movieId = forceMovieId;
  if (movieId === 'null' || movieId == null) {
    movieId = currentMovieId;
  }

  const movie = movies.find(m => m.id === movieId);
  if (!movie) {
    console.error('映画が見つかりません', movieId);
    return;
  }

  const scene = movie.scenes.find(s => s.id === sceneId);
  if (!scene) return;

  scene.status = checkbox.checked ? '撮影済み' : '未撮影';

  await saveMovie(movie);

  const currentHash = window.location.hash.replace('#', '');
  if (currentHash.startsWith('search/')) {
    renderSearchResults();
  } else if (currentHash.startsWith('daily/')) {
    const dateStr = currentHash.split('/')[1];
    executeGoDaily(dateStr, true);
  } else {
    renderMovie();
  }
};

window.renderSearchResults = function() {
  const movie = movies.find(m => m.id === currentMovieId);
  const list = document.getElementById('search-result-list');
  list.innerHTML = '';

  if(!movie || movie.scenes.length === 0) {
    list.innerHTML = '<p class="scene-info">まだシーンがありません。</p>';
    return;
  }

  lastSearchFilters.number = document.getElementById('search-number').value;
  lastSearchFilters.location = document.getElementById('search-location').value;
  lastSearchFilters.date = document.getElementById('search-date').value;
  lastSearchFilters.costume = document.getElementById('search-costume').value;
  lastSearchFilters.prop = document.getElementById('search-prop').value;


  let displayScenes = [...movie.scenes];

  const filterNum = document.getElementById('search-number').value;
  const filterLoc = document.getElementById('search-location').value;
  const filterDate = document.getElementById('search-date').value;
  const filterCos = document.getElementById('search-costume').value;
  const filterProp = document.getElementById('search-prop').value;

  if(filterNum) displayScenes = displayScenes.filter(s => String(s.number) === String(filterNum));
  if(filterLoc) {
    if(filterLoc === '未定') displayScenes = displayScenes.filter(s => !s.location);
    else displayScenes = displayScenes.filter(s => s.location === filterLoc);
  }
  if(filterDate) {
    if(filterDate === '未定') displayScenes = displayScenes.filter(s => !s.dates || s.dates.length === 0);
    else displayScenes = displayScenes.filter(s => s.dates && s.dates.includes(filterDate));
  }
  if(filterCos) displayScenes = displayScenes.filter(s => (s.costumes || []).some(c => c.name === filterCos));
  if(filterProp) displayScenes = displayScenes.filter(s => (s.props || []).some(p => p.name === filterProp));

  displayScenes.sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, {numeric: true, sensitivity: 'base'}));

  displayScenes.forEach(scene => list.appendChild(createSceneCard(scene)));
  if(displayScenes.length === 0) list.innerHTML = '<p class="scene-info">条件に合うシーンが見つかりませんでした</p>';
};

function renderMovie() {
  renderedMovieId = currentMovieId;
  const scrollY = window.scrollY; 
  const movie = movies.find(m => m.id === currentMovieId);
  const list = document.getElementById('scene-list');
  
  list.style.minHeight = list.offsetHeight + 'px';
  list.innerHTML = '';

  if(!movie || movie.scenes.length === 0) {
    list.innerHTML = '<p class="scene-info">まだシーンがありません</p>';
    list.style.minHeight = '';
    return;
  }

  if (currentViewMode === 'cos') {
    renderInventory(movie, list, 'costumes');
  } else if (currentViewMode === 'prop') {
    renderInventory(movie, list, 'props');
  } else {
    let displayScenes = [...movie.scenes];

    displayScenes.sort((a, b) => {
      if(currentSort === 'num-asc') return String(a.number).localeCompare(String(b.number), undefined, {numeric: true, sensitivity: 'base'});
      if(currentSort === 'num-desc') return String(b.number).localeCompare(String(a.number), undefined, {numeric: true, sensitivity: 'base'});
      if(currentSort === 'date-asc' || currentSort === 'date-desc') {
        const dateA = (a.dates && a.dates.length > 0) ? [...a.dates].sort()[0] : null;
        const dateB = (b.dates && b.dates.length > 0) ? [...b.dates].sort()[0] : null;
        if(!dateA && !dateB) return 0;
        if(!dateA) return 1;
        if(!dateB) return -1;
        return currentSort === 'date-asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      }
      return 0;
    });

    displayScenes.forEach(scene => list.appendChild(createSceneCard(scene)));
  }

  setTimeout(() => {
    list.style.minHeight = '';
    window.scrollTo(0, scrollY);
  }, 0);
}

function renderSceneViewDetail() {
  const movie = movies.find(m => m.id === currentMovieId);
  const scene = movie.scenes.find(s => s.id === currentSceneId);
  if(!scene) return;

  let titleText = `シーン ${scene.number}`;
  if(scene.sceneName) titleText += ` ｜ ${scene.sceneName}`;
  document.getElementById('view-scene-header').textContent = titleText;
  
  let dateText = (scene.dates && scene.dates.length > 0) ? scene.dates.join(', ') : '未定';
  let infoText = `場所: ${scene.location || '未定'} ｜ 撮影日: ${dateText}`;
  document.getElementById('view-scene-info').textContent = infoText;
  const memoArea = document.getElementById('view-scene-memo');
  if (memoArea) {
    if (scene.memo) {
      memoArea.innerHTML = `<strong>メモ</strong><br><div style="white-space: pre-wrap; background: rgba(0,0,0,0.03); padding: 8px; border-radius: 4px;">${scene.memo}</div>`;
      memoArea.style.display = 'block';
    } else {
      memoArea.style.display = 'none';
    }
  }

  const cList = document.getElementById('view-scene-costumes');
  cList.innerHTML = '';
  if(scene.costumes && scene.costumes.length > 0) {
    let html = `<strong style="color: var(--text-color);">衣装</strong><br>`;
    scene.costumes.forEach(c => {
      html += `<div style="padding: 8px; border-left: 2px solid var(--border-color); margin-bottom: 4px; background: rgba(0,0,0,0.02); display:flex; flex-direction:column; align-items:flex-start;">
        <div style="display:flex; align-items:flex-start; width:100%;">
          <span class="status-color status-${c.status}" style="padding:2px 4px; font-size:11px; flex-shrink:0; margin-right:6px; margin-top:2px;">${c.status}</span> 
          <strong style="word-break:break-all; line-height:1.4;">${c.name}</strong>
        </div>
        ${c.desc ? `<div class="scene-info" style="margin-top: 4px; width:100%; word-break:break-all;">${c.desc}</div>` : ''}
        ${c.price ? `<div class="scene-info" style="color:var(--muted-text); width:100%; word-break:break-all;">${c.price}</div>` : ''}
      </div>`;
    });
    cList.innerHTML = html;
  }

  const pList = document.getElementById('view-scene-props');
  pList.innerHTML = '';
  if(scene.props && scene.props.length > 0) {
    let html = `<strong style="color: var(--text-color);">小道具</strong><br>`;
    scene.props.forEach(p => {
      html += `<div style="padding: 8px; border-left: 2px solid var(--border-color); margin-bottom: 4px; background: rgba(0,0,0,0.02); display:flex; flex-direction:column; align-items:flex-start;">
        <div style="display:flex; align-items:flex-start; width:100%;">
          <span class="status-color status-${p.status}" style="padding:2px 4px; font-size:11px; flex-shrink:0; margin-right:6px; margin-top:2px;">${p.status}</span> 
          <strong style="word-break:break-all; line-height:1.4;">${p.name}</strong>
        </div>
        ${p.desc ? `<div class="scene-info" style="margin-top: 4px; width:100%; word-break:break-all;">${p.desc}</div>` : ''}
        ${p.price ? `<div class="scene-info" style="color:var(--muted-text); width:100%; word-break:break-all;">${p.price}</div>` : ''}
      </div>`;
    });
    pList.innerHTML = html;
  }
}

function renderSceneEditDetail() {
  const movie = movies.find(m => m.id === currentMovieId);
  const scene = movie.scenes.find(s => s.id === currentSceneId);
  if(!scene) return;
  
  document.getElementById('edit-scene-number').value = scene.number || '';
  document.getElementById('edit-scene-name').value = scene.sceneName || '';
  document.getElementById('edit-scene-location').value = scene.location || '';
  document.getElementById('edit-scene-memo').value = scene.memo || '';

  const dList = document.getElementById('edit-scene-dates');
  dList.innerHTML = '';
  if (scene.dates && scene.dates.length > 0) {
    scene.dates.forEach(d => window.addDateInput('edit-scene-dates', d));
  } else {
    window.addDateInput('edit-scene-dates');
  }

  const cList = document.getElementById('edit-costume-list');
  cList.innerHTML = '';
  (scene.costumes || []).forEach(c => window.addCostumeInput('edit-costume-list', c));

  const pList = document.getElementById('edit-prop-list');
  pList.innerHTML = '';
  (scene.props || []).forEach(p => window.addPropInput('edit-prop-list', p));
}

window.saveEditedScene = function() {
  if(!currentSceneId) return;
  const movie = movies.find(m => m.id === currentMovieId);
  const scene = movie.scenes.find(s => s.id === currentSceneId);
  
  scene.number = document.getElementById('edit-scene-number').value;
  scene.sceneName = document.getElementById('edit-scene-name').value;
  scene.location = document.getElementById('edit-scene-location').value;
  scene.memo = document.getElementById('edit-scene-memo').value.trim();
  scene.dates = collectDatesFromContainer('edit-scene-dates'); 
  
  const newCostumes = collectItemsFromDOM('edit-costume-list');
  const newProps = collectItemsFromDOM('edit-prop-list');

  scene.costumes = newCostumes;
  scene.props = newProps;

  syncItemStatuses(movie, newCostumes, 'costumes');
  syncItemStatuses(movie, newProps, 'props');

  saveMovie(movie); 
  populateSearchFilters();
  
  renderedMovieId = null;
  renderedDailyDate = null;
  
  window.cancelSceneEdit();
  alert('シーンの変更を保存しました');
};