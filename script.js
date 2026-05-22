let movies = [];
let currentMovieId = null;
let currentSceneId = null;
let currentViewMode = 'list'; // list, cos, prop
let currentSort = 'num-asc'; // num-asc, num-desc, date-asc, date-desc
let currentFilter = 'all'; // all, unfinished-cos, unfinished-prop

let globalCalYear = new Date().getFullYear();
let globalCalMonth = new Date().getMonth();

let isDarkMode = false;
function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  const body = document.body;
  const btn = document.getElementById('dark-mode-btn');
  if(isDarkMode) {
    body.classList.add('dark-mode');
    btn.textContent = '☀️';
  } else {
    body.classList.remove('dark-mode');
    btn.textContent = '🌙';
  }
  if (currentSceneId) renderSceneDetail();
}

function initDateDials() {
  const today = new Date();
  const curY = today.getFullYear();
  const prefixes = ['ns', 'ed']; 
  prefixes.forEach(p => {
    const ySel = document.getElementById(p+'-year');
    const mSel = document.getElementById(p+'-month');
    ySel.innerHTML = '<option value="">--</option>';
    mSel.innerHTML = '<option value="">--</option>';
    for(let i = curY - 3; i <= curY + 3; i++) ySel.add(new Option(i, i));
    for(let i = 1; i <= 12; i++) mSel.add(new Option(i, ('0'+i).slice(-2)));
  });
  setDialDate('ns', `${curY}-${('0'+(today.getMonth()+1)).slice(-2)}-${('0'+today.getDate()).slice(-2)}`);
}

function updateDays(prefix) {
  const y = document.getElementById(prefix+'-year').value;
  const m = document.getElementById(prefix+'-month').value;
  const dSel = document.getElementById(prefix+'-day');
  const currentD = dSel.value;
  dSel.innerHTML = '<option value="">--</option>';
  if(!y || !m) return;
  const maxDay = new Date(y, m, 0).getDate();
  for(let i = 1; i <= maxDay; i++) dSel.add(new Option(i, ('0'+i).slice(-2)));
  if(currentD && currentD <= maxDay) dSel.value = currentD;
}

function getDialDate(prefix) {
  const y = document.getElementById(prefix+'-year').value;
  const m = document.getElementById(prefix+'-month').value;
  const d = document.getElementById(prefix+'-day').value;
  if(y && m && d) return `${y}-${m}-${d}`;
  return '';
}

function setDialDate(prefix, dateStr) {
  const ySel = document.getElementById(prefix+'-year');
  const mSel = document.getElementById(prefix+'-month');
  const dSel = document.getElementById(prefix+'-day');
  if(!dateStr || dateStr.length < 8) {
    ySel.value = ''; mSel.value = ''; dSel.value = '';
  } else {
    const parts = dateStr.split(/[-/]/);
    ySel.value = parts[0] || '';
    mSel.value = ('0'+parts[1]).slice(-2) || '';
    updateDays(prefix);
    dSel.value = ('0'+parts[2]).slice(-2) || '';
  }
}

window.onload = () => { initDateDials(); };

function updateSelectColor(sel) {
  sel.classList.remove('status-未着手', 'status-準備中', 'status-準備完了', 'status-使用済み');
  sel.classList.add('status-' + sel.value);
}

function parseExcelDate(serial) {
  if (typeof serial === 'number') {
    const utc_days = Math.floor(serial - 25569);
    const date_info = new Date(utc_days * 86400 * 1000);
    return date_info.getUTCFullYear() + '-' + ('0' + (date_info.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + date_info.getUTCDate()).slice(-2);
  }
  return serial || '';
}

function showView(viewId) {
  document.getElementById('view-home').classList.add('hidden');
  document.getElementById('view-movie').classList.add('hidden');
  document.getElementById(viewId).classList.remove('hidden');
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goHome() { 
  currentMovieId = null;
  renderHome(); 
  document.getElementById('header-movie-title-nav').classList.add('hidden');
  document.getElementById('header-main-title').textContent = '製作映画一覧';
  showView('view-home'); 
}

function goMovie(movieId) { 
  currentMovieId = movieId; 
  closeSceneDetail();
  const movie = movies.find(m => m.id === currentMovieId);
  
  // ヘッダーの文字を変えます
  document.getElementById('header-movie-title-nav').classList.remove('hidden');
  document.getElementById('header-title-sub').textContent = movie.title;
  document.getElementById('header-main-title').textContent = movie.title;
  
  // 絞り込みをリセットします
  currentSort = 'num-asc';
  currentFilter = 'all';
  document.getElementById('sort-select').value = 'num-asc';
  document.getElementById('filter-select').value = 'all';
  
  updateDataLists(); 
  renderMovie(); 
  showView('view-movie'); 
}

// 🌐 他の映画のシーンでも直接開けるようにしました
function goScene(sceneId, forceMovieId = null) { 
  if(forceMovieId) {
    currentMovieId = forceMovieId;
    goMovie(currentMovieId);
  }
  currentSceneId = sceneId; 
  renderSceneDetail(); 
  const detailPane = document.getElementById('detail-pane');
  const listPane = document.getElementById('list-pane');

  detailPane.classList.add('show-detail');
  listPane.classList.add('hide-on-mobile'); 
  
  if(window.innerWidth < 800) window.scrollTo(0, 0); 
}

function closeSceneDetail() {
  document.getElementById('detail-pane').classList.remove('show-detail');
  document.getElementById('list-pane').classList.remove('hide-on-mobile');
  currentSceneId = null;
  renderMovie(); 
}

function addMovie() {
  const titleInput = document.getElementById('new-movie-title');
  const title = titleInput.value.trim();
  if (!title) return;
  movies.push({ id: Date.now(), title: title, scenes: [], isParticipating: true });
  titleInput.value = '';
  renderHome();
}

function toggleParticipation(movieId, event) {
  event.stopPropagation(); // カードが押されたことにならないように防ぎます
  const movie = movies.find(m => m.id === movieId);
  movie.isParticipating = !movie.isParticipating;
  renderHome();
}

function handleExcelUpload(event) {
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
      newScenes.push({
        id: Date.now() + index,
        number: row[0] || '', 
        date: parseExcelDate(row[1]),
        sceneName: row[2] || '', location: row[3] || '',
        costumeStatus: row[4] || '未着手', costumeName: row[5] || '', costumeDesc: row[6] || '', costumePrice: row[7] || '',
        propStatus: row[8] || '未着手', propName: row[9] || '', propDesc: row[10] || '', propPrice: row[11] || ''
      });
    });

    const movieTitle = file.name.replace(/\.[^/.]+$/, "");
    movies.push({ id: Date.now(), title: movieTitle, scenes: newScenes, isParticipating: true });
    renderHome();
    document.getElementById('excel-upload').value = '';
    alert(movieTitle + ' のデータを読み込みました……！');
  };
  reader.readAsArrayBuffer(file);
}

// --- 🌐 全体カレンダーを描く魔法 ---
function renderGlobalCalendar() {
  const container = document.getElementById('global-calendar');
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'cal-header';
  header.innerHTML = `
    <button onclick="changeGlobalCalMonth(-1)">◀</button>
    <strong>${globalCalYear}年 ${globalCalMonth + 1}月</strong>
    <button onclick="changeGlobalCalMonth(1)">▶</button>
  `;
  container.appendChild(header);

  const table = document.createElement('table');
  table.className = 'calendar-table';
  table.innerHTML = '<tr><th>日</th><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th><th>土</th></tr>';
  
  const firstDay = new Date(globalCalYear, globalCalMonth, 1).getDay();
  const daysInMonth = new Date(globalCalYear, globalCalMonth + 1, 0).getDate();
  
  let tr = document.createElement('tr');
  for(let i = 0; i < firstDay; i++) tr.appendChild(document.createElement('td'));
  
  // 「参加」になっている映画のシーンだけを集めます
  let activeScenes = [];
  movies.filter(m => m.isParticipating).forEach(m => {
    m.scenes.forEach(s => activeScenes.push({ movie: m, scene: s }));
  });

  for(let day = 1; day <= daysInMonth; day++) {
    if(tr.children.length === 7) { table.appendChild(tr); tr = document.createElement('tr'); }
    const td = document.createElement('td');
    td.innerHTML = `<span class="cal-day-num">${day}</span>`;
    
    const dateStr = `${globalCalYear}-${('0'+(globalCalMonth+1)).slice(-2)}-${('0'+day).slice(-2)}`;
    
    // この日のシーンを探して表示します
    const dayScenes = activeScenes.filter(item => item.scene.date === dateStr || item.scene.date === dateStr.replace(/-0/g, '-')); 
    
    dayScenes.forEach(item => {
      const marker = document.createElement('span');
      marker.className = 'cal-marker';
      marker.innerHTML = `⭕ [${item.movie.title}] シーン${item.scene.number}`;
      marker.onclick = () => goScene(item.scene.id, item.movie.id);
      td.appendChild(marker);
    });
    tr.appendChild(td);
  }
  while(tr.children.length < 7) tr.appendChild(document.createElement('td'));
  table.appendChild(tr);
  container.appendChild(table);
}

function changeGlobalCalMonth(diff) {
  globalCalMonth += diff;
  if(globalCalMonth < 0) { globalCalMonth = 11; globalCalYear--; }
  if(globalCalMonth > 11) { globalCalMonth = 0; globalCalYear++; }
  renderHome();
}

function renderHome() {
  renderGlobalCalendar(); // カレンダーを更新します

  const list = document.getElementById('movie-list');
  list.innerHTML = '';
  if(movies.length === 0) {
    list.innerHTML = '<p class="scene-info">まだ登録された映画がありません。</p>';
    return;
  }
  movies.forEach(movie => {
    const div = document.createElement('div');
    div.className = 'card movie-list-item';
    
    // 参加・非参加のボタンを作ります
    const isPart = movie.isParticipating !== false; // 古いデータ対策です
    const toggleClass = isPart ? 'active' : '';
    const toggleText = isPart ? '✔ 参加中' : '非参加';

    div.innerHTML = `
      <div class="movie-info" onclick="goMovie(${movie.id})">
        <strong>${movie.title}</strong><br>
        <span class="scene-info">登録シーン数: ${movie.scenes.length}件</span>
      </div>
      <button class="participation-toggle ${toggleClass}" onclick="toggleParticipation(${movie.id}, event)">${toggleText}</button>
    `;
    list.appendChild(div);
  });
}

function checkSceneInput() {
  const num = document.getElementById('scene-number').value.trim();
  const name = document.getElementById('scene-name').value.trim();
  const loc = document.getElementById('scene-location').value.trim();
  const date = getDialDate('ns');
  const btn = document.getElementById('add-scene-btn');
  btn.disabled = !(num !== '' && (name !== '' || loc !== '' || date !== ''));
}

function addScene() {
  const num = document.getElementById('scene-number').value.trim();
  const name = document.getElementById('scene-name').value.trim();
  const loc = document.getElementById('scene-location').value.trim();
  const date = getDialDate('ns');

  const movie = movies.find(m => m.id === currentMovieId);
  movie.scenes.push({
    id: Date.now(), number: num, sceneName: name, location: loc, date: date,
    costumeStatus: '未着手', costumeName: '', costumeDesc: '', costumePrice: '',
    propStatus: '未着手', propName: '', propDesc: '', propPrice: ''
  });

  document.getElementById('scene-number').value = '';
  document.getElementById('scene-name').value = '';
  document.getElementById('scene-location').value = '';
  checkSceneInput();
  updateDataLists();
  renderMovie();
}

function deleteScene() {
  if(!currentSceneId) return;
  if(confirm("本当にこのシーンを削除してもよろしいですか……？")) {
    const movie = movies.find(m => m.id === currentMovieId);
    movie.scenes = movie.scenes.filter(s => s.id !== currentSceneId);
    closeSceneDetail(); 
    updateDataLists();
  }
}

function splitItems(text) {
  if(!text) return [];
  return text.replace(/、/g, ',').split(',').map(i => i.trim()).filter(i => i !== '');
}

function getUniqueItems(movie, typeKey) {
  const items = new Set();
  movie.scenes.forEach(s => {
    splitItems(s[typeKey]).forEach(item => items.add(item));
  });
  return Array.from(items);
}

function updateDataLists() {
  if(!currentMovieId) return;
  const movie = movies.find(m => m.id === currentMovieId);
  const cList = document.getElementById('costume-datalist');
  const pList = document.getElementById('prop-datalist');
  
  cList.innerHTML = ''; pList.innerHTML = '';
  getUniqueItems(movie, 'costumeName').sort().forEach(i => cList.appendChild(new Option(i)));
  getUniqueItems(movie, 'propName').sort().forEach(i => pList.appendChild(new Option(i)));
}

function setViewMode(mode) {
  currentViewMode = mode;
  ['list', 'cos', 'prop'].forEach(id => {
    document.getElementById('btn-view-' + id).classList.remove('active');
  });
  document.getElementById('btn-view-' + mode).classList.add('active');
  
  // 衣装・小道具モードの時は、絞り込みメニューを隠します
  const bar = document.getElementById('sort-filter-bar');
  if(mode === 'list') { bar.style.display = 'flex'; }
  else { bar.style.display = 'none'; }
  
  renderMovie();
}

function updateSort(val) { currentSort = val; renderMovie(); }
function updateFilter(val) { currentFilter = val; renderMovie(); }

function createSceneCard(scene) {
  const div = document.createElement('div');
  div.className = 'card';
  if(scene.id === currentSceneId) div.style.border = '2px solid var(--accent-color)';

  let html = `<strong>シーン ${scene.number}</strong>`;
  if(scene.sceneName) html += ` ｜ ${scene.sceneName}`;
  if(scene.location) html += ` ｜ ${scene.location}`;
  html += `<div class="scene-info">撮影日: ${scene.date || '未定'}<br>`;
  
  if(scene.costumeName) html += `👗 ${scene.costumeName}<br>`;
  if(scene.propName) html += `📦 ${scene.propName}<br>`;
  html += `</div>`;
  
  html += `
    <div style="margin-top: 8px;">
      <span class="status-badge status-${scene.costumeStatus}">衣装: ${scene.costumeStatus}</span>
      <span class="status-badge status-${scene.propStatus}">小道具: ${scene.propStatus}</span>
    </div>
  `;
  div.innerHTML = html;
  div.onclick = () => goScene(scene.id);
  return div;
}

// 🕒 アイテムが「一番早く使われる日」を探す魔法です
function getEarliestDate(movie, typeKey, itemName) {
  const scenes = movie.scenes.filter(s => splitItems(s[typeKey]).includes(itemName) && s.date);
  if(scenes.length === 0) return null;
  const dates = scenes.map(s => s.date).sort();
  return dates[0];
}

function renderInventory(movie, listContainer, typeKey, icon) {
  let uniqueItems = getUniqueItems(movie, typeKey);
  
  if(uniqueItems.length === 0) {
    listContainer.innerHTML = '<p class="scene-info">まだ登録されていません。</p>';
    return;
  }

  // ★「使う日が早い順」に並べ替えます
  uniqueItems.sort((a, b) => {
    let dateA = getEarliestDate(movie, typeKey, a);
    let dateB = getEarliestDate(movie, typeKey, b);
    if(!dateA && !dateB) return 0; // どちらも未定
    if(!dateA) return 1;           // Aが未定なら後ろへ
    if(!dateB) return -1;          // Bが未定なら後ろへ
    return dateA.localeCompare(dateB);
  });

  uniqueItems.forEach(item => {
    const earliest = getEarliestDate(movie, typeKey, item);
    const header = document.createElement('h4');
    header.className = 'inventory-header';
    header.innerHTML = `${icon} ${item} <span style="font-size:12px; color:#666; font-weight:normal;">(最速使用日: ${earliest || '未定'})</span>`;
    listContainer.appendChild(header);
    
    const matchingScenes = movie.scenes.filter(s => splitItems(s[typeKey]).includes(item));
    matchingScenes.sort((a, b) => Number(a.number) - Number(b.number)).forEach(scene => {
      listContainer.appendChild(createSceneCard(scene));
    });
  });
}

function renderMovie() {
  const movie = movies.find(m => m.id === currentMovieId);
  const list = document.getElementById('scene-list');
  list.innerHTML = '';

  if(movie.scenes.length === 0) {
    list.innerHTML = '<p class="scene-info">まだシーンがありません。</p>';
    return;
  }

  if (currentViewMode === 'cos') {
    renderInventory(movie, list, 'costumeName', '👗');
  } else if (currentViewMode === 'prop') {
    renderInventory(movie, list, 'propName', '📦');
  } else {
    // リスト表示（絞り込み・並べ替え）
    let displayScenes = [...movie.scenes];

    // 🔍 絞り込み
    if(currentFilter === 'unfinished-cos') {
      displayScenes = displayScenes.filter(s => s.costumeStatus === '未着手' || s.costumeStatus === '準備中');
    } else if (currentFilter === 'unfinished-prop') {
      displayScenes = displayScenes.filter(s => s.propStatus === '未着手' || s.propStatus === '準備中');
    }

    // 🔄 並べ替え
    displayScenes.sort((a, b) => {
      if(currentSort === 'num-asc') return Number(a.number) - Number(b.number);
      if(currentSort === 'num-desc') return Number(b.number) - Number(a.number);
      if(currentSort === 'date-asc' || currentSort === 'date-desc') {
        if(!a.date && !b.date) return 0;
        if(!a.date) return 1;
        if(!b.date) return -1;
        return currentSort === 'date-asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
      }
      return 0;
    });

    displayScenes.forEach(scene => list.appendChild(createSceneCard(scene)));
    if(displayScenes.length === 0) list.innerHTML = '<p class="scene-info">条件に合うシーンがありませんでした……。</p>';
  }
}

function renderSceneDetail() {
  const movie = movies.find(m => m.id === currentMovieId);
  const scene = movie.scenes.find(s => s.id === currentSceneId);
  
  document.getElementById('edit-scene-number').value = scene.number || '';
  document.getElementById('edit-scene-name').value = scene.sceneName || '';
  document.getElementById('edit-scene-location').value = scene.location || '';
  setDialDate('ed', scene.date);

  const cStatus = document.getElementById('edit-costume-status');
  cStatus.value = scene.costumeStatus || '未着手';
  updateSelectColor(cStatus); 
  document.getElementById('edit-costume-name').value = scene.costumeName || '';
  document.getElementById('edit-costume-desc').value = scene.costumeDesc || '';
  document.getElementById('edit-costume-price').value = scene.costumePrice || '';
  
  const pStatus = document.getElementById('edit-prop-status');
  pStatus.value = scene.propStatus || '未着手';
  updateSelectColor(pStatus); 
  document.getElementById('edit-prop-name').value = scene.propName || '';
  document.getElementById('edit-prop-desc').value = scene.propDesc || '';
  document.getElementById('edit-prop-price').value = scene.propPrice || '';

  renderMovie();
}

function saveSceneBasicInfo() {
  if(!currentSceneId) return;
  const movie = movies.find(m => m.id === currentMovieId);
  const scene = movie.scenes.find(s => s.id === currentSceneId);
  
  scene.number = document.getElementById('edit-scene-number').value;
  scene.sceneName = document.getElementById('edit-scene-name').value;
  scene.location = document.getElementById('edit-scene-location').value;
  scene.date = getDialDate('ed'); 
  
  renderMovie(); 
}

function saveSceneDetail() {
  if(!currentSceneId) return;
  const movie = movies.find(m => m.id === currentMovieId);
  const scene = movie.scenes.find(s => s.id === currentSceneId);
  
  scene.costumeStatus = document.getElementById('edit-costume-status').value;
  scene.costumeName = document.getElementById('edit-costume-name').value;
  scene.costumeDesc = document.getElementById('edit-costume-desc').value;
  scene.costumePrice = document.getElementById('edit-costume-price').value;
  
  scene.propStatus = document.getElementById('edit-prop-status').value;
  scene.propName = document.getElementById('edit-prop-name').value;
  scene.propDesc = document.getElementById('edit-prop-desc').value;
  scene.propPrice = document.getElementById('edit-prop-price').value;

  updateDataLists(); 
  renderMovie(); 
}