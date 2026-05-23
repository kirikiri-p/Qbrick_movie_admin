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

let globalCalYear = new Date().getFullYear();
let globalCalMonth = new Date().getMonth();

function migrateSceneData(scene) {
  if (!scene.costumes) {
    scene.costumes = [];
    if (scene.costumeName) {
      scene.costumeName.split(',').forEach((name, i) => {
        if(name.trim()) scene.costumes.push({ id: 'c' + Date.now() + i, name: name.trim(), status: scene.costumeStatus || '未着手', desc: scene.costumeDesc || '', price: scene.costumePrice || '' });
      });
    }
  }
  if (!scene.props) {
    scene.props = [];
    if (scene.propName) {
      scene.propName.split(',').forEach((name, i) => {
        if(name.trim()) scene.props.push({ id: 'p' + Date.now() + i, name: name.trim(), status: scene.propStatus || '未着手', desc: scene.propDesc || '', price: scene.propPrice || '' });
      });
    }
  }
  return scene;
}

onSnapshot(moviesRef, (snapshot) => {
  movies = [];
  snapshot.forEach((doc) => {
    let data = doc.data();
    data.scenes = data.scenes.map(migrateSceneData); 
    movies.push(data);
  });
  
  if (currentMovieId) {
    if (!movies.find(m => m.id === currentMovieId)) {
      goHome();
    } else {
      updateDataLists();
      populateSearchFilters();
      if(!document.getElementById('view-search').classList.contains('hidden')) {
        renderSearchResults();
      } else if(!document.getElementById('view-movie-details').classList.contains('hidden')) {
        // 映画詳細画面の場合は再描画保留
      } else {
        renderMovie();
      }
      if(currentSceneId) {
        if(document.getElementById('detail-pane-edit').classList.contains('hidden')) {
          renderSceneViewDetail(); // 閲覧モードの更新
        } else {
          renderSceneEditDetail(); // 編集モードの更新
        }
      }
    }
  } else if (!document.getElementById('view-daily').classList.contains('hidden')) {
    // 予定画面の場合は再描画保留
  } else {
    renderHome();
  }
});

async function saveMovie(movie) {
  await setDoc(doc(db, "movies", movie.id.toString()), movie);
}

// 🌟 映画詳細画面（監督や年度の登録）の魔法です
function goMovieDetails(movieId) {
  currentMovieId = movieId;
  const movie = movies.find(m => m.id === currentMovieId);
  document.getElementById('movie-detail-title').value = movie.title || '';
  document.getElementById('movie-detail-type').value = movie.type || '';
  document.getElementById('movie-detail-director').value = movie.director || '';
  document.getElementById('movie-detail-year').value = movie.year || '';
  showView('view-movie-details');
}

function saveMovieDetails() {
  const movie = movies.find(m => m.id === currentMovieId);
  movie.title = document.getElementById('movie-detail-title').value.trim();
  movie.type = document.getElementById('movie-detail-type').value;
  movie.director = document.getElementById('movie-detail-director').value.trim();
  movie.year = document.getElementById('movie-detail-year').value.trim();
  
  if(!movie.title) { alert('タイトルは必須です。'); return; }
  saveMovie(movie);
  goHome();
}

async function deleteMovieFromDetails() {
  const movie = movies.find(m => m.id === currentMovieId);
  if(confirm(`映画「${movie.title}」を本当に削除しますか？\n登録されたシーンもすべて消えてしまいます。`)) {
    await deleteDoc(doc(db, "movies", currentMovieId.toString()));
    goHome();
  }
}

function getParticipation(movieId) { return localStorage.getItem('part_' + movieId) === 'true'; }
function toggleParticipation(movieId, event) {
  event.stopPropagation(); 
  const current = getParticipation(movieId);
  localStorage.setItem('part_' + movieId, current ? 'false' : 'true');
  renderHome(); 
}

let isDarkMode = false;
function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  const body = document.body;
  if(isDarkMode) {
    body.classList.add('dark-mode');
    document.getElementById('dark-mode-btn').textContent = '☀️';
  } else {
    body.classList.remove('dark-mode');
    document.getElementById('dark-mode-btn').textContent = '🌙';
  }
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

  const newSceneDetails = document.getElementById('new-scene-details');
  if (newSceneDetails) newSceneDetails.removeAttribute('open');
}

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

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
  selectedSceneIds.clear();
  document.getElementById('bulk-delete-btn').classList.add('hidden');

  const movie = movies.find(m => m.id === currentMovieId);
  document.getElementById('header-movie-title-nav').classList.remove('hidden');
  document.getElementById('header-title-sub').textContent = movie.title;
  document.getElementById('header-main-title').textContent = movie.title;
  
  updateDataLists();
  populateSearchFilters();
  setViewMode('list');
  showView('view-movie'); 
}

function goSearch() {
  populateSearchFilters();
  clearSearch(false);
  renderSearchResults();
  showView('view-search');
}

// 🌟 検索からちゃんと戻るための魔法です
function backFromSearch() {
  showView('view-movie');
  renderMovie();
}

function goScene(sceneId, forceMovieId = null) { 
  if(forceMovieId) {
    currentMovieId = forceMovieId;
    goMovie(currentMovieId); // この中で view-movie になります
  }
  currentSceneId = sceneId; 
  
  // 🌟 シーンを押した時は、まず「見るだけ（View）」の画面を出します
  document.getElementById('detail-pane-edit').classList.add('hidden');
  document.getElementById('detail-pane-view').classList.remove('hidden');
  renderSceneViewDetail(); 

  const detailPane = document.getElementById('detail-pane');
  const listPane = document.getElementById('list-pane');
  detailPane.classList.add('show-detail');
  listPane.classList.add('hide-on-mobile'); 
  
  if(window.innerWidth < 800) window.scrollTo(0, 0); 
}

// 🌟 「編集する」ボタンを押した時の魔法です
function openSceneEdit() {
  document.getElementById('detail-pane-view').classList.add('hidden');
  document.getElementById('detail-pane-edit').classList.remove('hidden');
  renderSceneEditDetail();
}

function cancelSceneEdit() {
  document.getElementById('detail-pane-edit').classList.add('hidden');
  document.getElementById('detail-pane-view').classList.remove('hidden');
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
  const newMovie = { id: Date.now(), title: title, scenes: [], type: '', director: '', year: '' };
  saveMovie(newMovie); 
  titleInput.value = '';
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
      const number = String(row[0] || '');
      const date = parseExcelDate(row[1]);
      const sceneName = String(row[2] || '');
      const location = String(row[3] || '');
      
      const costumes = row[5] ? row[5].split(',').map((n,i)=>({id:'c'+Date.now()+i+Math.random(), name:n.trim(), status:row[4]||'未着手', desc:row[6]||'', price:row[7]||''})) : [];
      const props = row[9] ? row[9].split(',').map((n,i)=>({id:'p'+Date.now()+i+Math.random(), name:n.trim(), status:row[8]||'未着手', desc:row[10]||'', price:row[11]||''})) : [];

      const existing = newScenes.find(s => s.number === number && s.sceneName === sceneName && s.location === location);
      if (existing) {
        if(costumes.length > 0) existing.costumes.push(...costumes);
        if(props.length > 0) existing.props.push(...props);
      } else {
        newScenes.push({
          id: Date.now() + index, number: number, date: date, sceneName: sceneName, location: location, costumes: costumes, props: props
        });
      }
    });

    const movieTitle = file.name.replace(/\.[^/.]+$/, "");
    const newMovie = { id: Date.now(), title: movieTitle, scenes: newScenes, type: '', director: '', year: '' };
    saveMovie(newMovie); 
    document.getElementById('excel-upload').value = '';
    alert(movieTitle + ' のデータを読み込みました。');
  };
  reader.readAsArrayBuffer(file);
}

// 🌟 シーン全体の達成度（色）を判定する魔法です
function getSceneOverallStatus(scene) {
  const items = [...(scene.costumes || []), ...(scene.props || [])];
  if(items.length === 0) return 'none'; // アイテムがなければ色なし
  
  let hasAlert = false;
  let allUsed = true;
  let allReadyOrUsed = true;

  items.forEach(i => {
    if(i.status === '未着手' || i.status === '準備中') hasAlert = true;
    if(i.status !== '使用済み') allUsed = false;
    if(i.status !== '準備完了' && i.status !== '使用済み') allReadyOrUsed = false;
  });

  if(hasAlert) return 'alert';       // 赤（どれか一つでも未達成がある）
  if(allUsed) return 'used';         // 青（すべて使用済み）
  if(allReadyOrUsed) return 'ready'; // 緑（すべて準備完了か使用済み）
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
    if(getParticipation(m.id)) {
      m.scenes.forEach(s => activeScenes.push({ movie: m, scene: s }));
    }
  });

  for(let day = 1; day <= daysInMonth; day++) {
    if(tr.children.length === 7) { table.appendChild(tr); tr = document.createElement('tr'); }
    const td = document.createElement('td');
    td.innerHTML = `<span class="cal-day-num">${day}</span>`;
    
    const dateStr = `${globalCalYear}-${('0'+(globalCalMonth+1)).slice(-2)}-${('0'+day).slice(-2)}`;
    const dayScenes = activeScenes.filter(item => item.scene.date === dateStr || item.scene.date === dateStr.replace(/-0/g, '-')); 
    
    if(dayScenes.length > 0) {
      td.style.cursor = 'pointer';
      td.style.backgroundColor = 'rgba(25, 118, 210, 0.05)';
      td.onclick = () => showDailyScenes(dateStr, dayScenes);
      
      dayScenes.forEach(item => {
        const overall = getSceneOverallStatus(item.scene);
        const marker = document.createElement('span');
        marker.className = `cal-marker cal-marker-${overall}`; // カレンダーにも色をつけます！
        marker.innerHTML = `[${item.movie.title}] S${item.scene.number}`;
        marker.onclick = (e) => { e.stopPropagation(); goScene(item.scene.id, item.movie.id); };
        td.appendChild(marker);
      });
    }
    tr.appendChild(td);
  }
  while(tr.children.length < 7) tr.appendChild(document.createElement('td'));
  table.appendChild(tr);
  container.appendChild(table);
}

function showDailyScenes(dateStr, dayScenes) {
  document.getElementById('header-movie-title-nav').classList.remove('hidden');
  document.getElementById('header-title-sub').textContent = `${dateStr} の予定`;
  document.getElementById('header-main-title').textContent = `${dateStr} の撮影予定`;
  
  document.getElementById('daily-date-title').textContent = `${dateStr} の撮影予定`;
  const container = document.getElementById('daily-scene-list-container');
  container.innerHTML = '';
  
  dayScenes.sort((a, b) => Number(a.scene.number) - Number(b.scene.number)).forEach(item => {
    const card = createSceneCard(item.scene, item.movie.id);
    const titleObj = document.createElement('div');
    titleObj.innerHTML = `<strong style="color: #1976d2; font-size: 14px;">映画: ${item.movie.title}</strong><hr style="border:0; border-top:1px dashed #ccc; margin: 4px 0;">`;
    card.prepend(titleObj);
    container.appendChild(card);
  });
  
  showView('view-daily');
}

function changeGlobalCalMonth(diff) {
  globalCalMonth += diff;
  if(globalCalMonth < 0) { globalCalMonth = 11; globalCalYear--; }
  if(globalCalMonth > 11) { globalCalMonth = 0; globalCalYear++; }
  renderHome();
}

function renderHome() {
  renderGlobalCalendar(); 

  const list = document.getElementById('movie-list');
  list.innerHTML = '';
  if(movies.length === 0) {
    list.innerHTML = '<p class="scene-info">まだ登録された映画がありません。</p>';
    return;
  }
  movies.forEach(movie => {
    const div = document.createElement('div');
    div.className = 'card movie-list-item';
    
    const isPart = getParticipation(movie.id); 
    const toggleClass = isPart ? 'active' : '';
    const toggleText = isPart ? '参加中' : '不参加';

    let detailText = `${movie.scenes.length}件のシーン`;
    if(movie.director) detailText += ` ｜ 監督: ${movie.director}`;
    if(movie.year) detailText += ` ｜ ${movie.year}年`;

    div.innerHTML = `
      <div class="movie-info" onclick="goMovie(${movie.id})">
        <strong>${movie.type ? `[${movie.type}] ` : ''}${movie.title}</strong>
        <div class="scene-info" style="margin-left: 12px; margin-top: 0;">${detailText}</div>
      </div>
      <div class="movie-actions">
        <button class="participation-toggle ${toggleClass}" onclick="toggleParticipation(${movie.id}, event)">${toggleText}</button>
        <button class="edit-title-btn" onclick="event.stopPropagation(); goMovieDetails(${movie.id})">[編集]</button>
      </div>
    `;
    list.appendChild(div);
  });
}

function checkSceneInput() {
  const num = document.getElementById('new-scene-number').value.trim();
  const btn = document.getElementById('add-scene-btn');
  btn.disabled = (num === '');
}

function createItemInputHTML(type, item = null) {
  const id = item ? item.id : Date.now() + Math.random().toString(36).substring(2,7);
  const status = item ? item.status : '未着手';
  const name = item ? item.name : '';
  const desc = item ? item.desc : '';
  const price = item ? item.price : '';
  const listId = type === 'costume' ? 'costume-datalist' : 'prop-datalist';
  
  const div = document.createElement('div');
  div.className = 'item-input-block';
  div.dataset.id = id;
  
  div.innerHTML = `
    <button type="button" class="item-remove-btn" onclick="this.closest('.item-input-block').remove()" title="この枠を消す">[x]</button>
    <select class="item-status status-color status-${status}" onchange="updateSelectColor(this)">
      <option value="未着手" ${status==='未着手'?'selected':''}>未着手</option>
      <option value="準備中" ${status==='準備中'?'selected':''}>準備中</option>
      <option value="準備完了" ${status==='準備完了'?'selected':''}>準備完了</option>
      <option value="使用済み" ${status==='使用済み'?'selected':''}>使用済み</option>
    </select>
    <input type="text" class="item-name" list="${listId}" placeholder="${type==='costume'?'衣装名':'物品名'}" value="${name}" oninput="autoFillItem(this, '${type}')">
    <textarea class="item-desc" placeholder="詳細">${desc}</textarea>
    <input type="text" class="item-price" placeholder="金額/メモ" value="${price}">
  `;
  return div;
}

function addCostumeInput(containerId, item = null) {
  document.getElementById(containerId).appendChild(createItemInputHTML('costume', item));
}
function addPropInput(containerId, item = null) {
  document.getElementById(containerId).appendChild(createItemInputHTML('prop', item));
}

function autoFillItem(inputElem, type) {
  const name = inputElem.value.trim();
  if(!name) return;
  
  let found = null;
  for(let m of movies) {
    for(let s of m.scenes) {
       const items = type === 'costume' ? s.costumes : s.props;
       if(!items) continue;
       found = items.find(i => i.name === name && (i.desc || i.price));
       if(found) break;
    }
    if(found) break;
  }
  
  if(found) {
    const block = inputElem.closest('.item-input-block');
    const descInput = block.querySelector('.item-desc');
    const priceInput = block.querySelector('.item-price');
    if(descInput && !descInput.value) descInput.value = found.desc;
    if(priceInput && !priceInput.value) priceInput.value = found.price;
  }
}

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

function addScene() {
  const num = document.getElementById('new-scene-number').value.trim();
  const name = document.getElementById('new-scene-name').value.trim();
  const loc = document.getElementById('new-scene-location').value.trim();
  const date = getDialDate('ns');

  const movie = movies.find(m => m.id === currentMovieId);
  movie.scenes.push({
    id: Date.now(), number: num, sceneName: name, location: loc, date: date,
    costumes: collectItemsFromDOM('new-costume-list'),
    props: collectItemsFromDOM('new-prop-list')
  });

  saveMovie(movie); 
  
  document.getElementById('new-scene-number').value = '';
  document.getElementById('new-scene-name').value = '';
  document.getElementById('new-scene-location').value = '';
  document.getElementById('new-costume-list').innerHTML = '';
  document.getElementById('new-prop-list').innerHTML = '';
  document.getElementById('new-scene-details').removeAttribute('open');
  
  checkSceneInput();
}

function toggleSceneSelection(sceneId, checkbox, event) {
  event.stopPropagation();
  if(checkbox.checked) selectedSceneIds.add(sceneId);
  else selectedSceneIds.delete(sceneId);
  
  const btn = document.getElementById('bulk-delete-btn');
  if(selectedSceneIds.size > 0) btn.classList.remove('hidden');
  else btn.classList.add('hidden');
  
  const card = checkbox.closest('.card');
  if(checkbox.checked) card.classList.add('selected-card');
  else card.classList.remove('selected-card');
}

function deleteSelectedScenes() {
  if(confirm(`${selectedSceneIds.size}件のシーンを削除しますか？`)) {
    const movie = movies.find(m => m.id === currentMovieId);
    movie.scenes = movie.scenes.filter(s => !selectedSceneIds.has(s.id));
    selectedSceneIds.clear();
    document.getElementById('bulk-delete-btn').classList.add('hidden');
    saveMovie(movie);
  }
}

function deleteScene() {
  if(!currentSceneId) return;
  if(confirm("本当にこのシーンを削除してもよろしいですか？")) {
    const movie = movies.find(m => m.id === currentMovieId);
    movie.scenes = movie.scenes.filter(s => s.id !== currentSceneId);
    saveMovie(movie); 
    closeSceneDetail(); 
  }
}

function clearSearch(doRender = true) {
  ['number', 'location', 'date', 'costume', 'prop'].forEach(id => {
    document.getElementById('search-' + id).value = '';
  });
  if(doRender) renderSearchResults();
}

function getUniqueProperties(movie, propName) {
  const items = new Set();
  movie.scenes.forEach(s => {
    if(s[propName]) items.add(s[propName]);
  });
  let arr = Array.from(items).filter(x => x);
  // シーン番号の選択肢が数字順になるように賢くしました……！
  if (propName === 'number') {
    arr.sort((a, b) => Number(a) - Number(b));
  } else {
    arr.sort();
  }
  return arr;
}
function getUniqueItemNames(movie, typeKey) {
  const names = new Set();
  movie.scenes.forEach(s => {
    const items = typeKey === 'costumes' ? s.costumes : s.props;
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
  getUniqueProperties(movie, 'date').forEach(v => dateSel.add(new Option(v, v)));
  getUniqueItemNames(movie, 'costumes').forEach(v => cosSel.add(new Option(v, v)));
  getUniqueItemNames(movie, 'props').forEach(v => propSel.add(new Option(v, v)));

  [numSel, locSel, dateSel, cosSel, propSel].forEach(s => {
    if(s.dataset.current) s.value = s.dataset.current;
  });
}

function updateDataLists() {
  if(!currentMovieId) return;
  const movie = movies.find(m => m.id === currentMovieId);
  const cList = document.getElementById('costume-datalist');
  const pList = document.getElementById('prop-datalist');
  
  cList.innerHTML = ''; pList.innerHTML = '';
  getUniqueItemNames(movie, 'costumes').forEach(i => cList.appendChild(new Option(i)));
  getUniqueItemNames(movie, 'props').forEach(i => pList.appendChild(new Option(i)));
}

function setViewMode(mode) {
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
    sortSel.add(new Option('名前順', 'name-asc'));
    sortSel.add(new Option('最速使用日が早い順', 'date-asc'));
    sortSel.add(new Option('使用シーンが多い順', 'count-desc'));
    currentSort = 'count-desc';
    sortSel.value = 'count-desc';
  }
  
  renderMovie();
}

function updateSort(val) { currentSort = val; renderMovie(); }

function createSceneCard(scene, forceMovieId = null) {
  const div = document.createElement('div');
  div.className = 'card';
  if(scene.id === currentSceneId) div.style.border = '2px solid var(--accent-color)';
  if(selectedSceneIds.has(scene.id)) div.classList.add('selected-card');

  // 🌟 全体の達成度から、左端に色線を引きます
  const overall = getSceneOverallStatus(scene);
  div.classList.add(`scene-border-${overall}`);

  let html = `<div class="scene-card-header">`;
  
  if(!forceMovieId) {
    html += `<input type="checkbox" class="scene-checkbox" ${selectedSceneIds.has(scene.id)?'checked':''} onclick="toggleSceneSelection(${scene.id}, this, event)">`;
  }
  
  html += `<div class="scene-content">`;
  html += `<strong>シーン ${scene.number}</strong>`;
  if(scene.sceneName) html += ` ｜ ${scene.sceneName}`;
  if(scene.location) html += ` ｜ ${scene.location}`;
  html += `<div class="scene-info">撮影日: ${scene.date || '未定'}</div>`;
  
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
  div.onclick = () => goScene(scene.id, forceMovieId);
  return div;
}

function getEarliestDate(movie, typeKey, itemName) {
  const scenes = movie.scenes.filter(s => {
    const items = typeKey === 'costumes' ? s.costumes : s.props;
    return items.some(i => i.name === itemName) && s.date;
  });
  if(scenes.length === 0) return null;
  const dates = scenes.map(s => s.date).sort();
  return dates[0];
}

function renderInventory(movie, listContainer, typeKey) {
  let uniqueNames = getUniqueItemNames(movie, typeKey);
  
  if(uniqueNames.length === 0) {
    listContainer.innerHTML = '<p class="scene-info">まだ登録されていません。</p>';
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
      const countA = movie.scenes.filter(s => (typeKey === 'costumes' ? s.costumes : s.props).some(i => i.name === a)).length;
      const countB = movie.scenes.filter(s => (typeKey === 'costumes' ? s.costumes : s.props).some(i => i.name === b)).length;
      return countB - countA;
    }
    return 0;
  });

  uniqueNames.forEach(name => {
    const matchingScenes = movie.scenes.filter(s => {
      const items = typeKey === 'costumes' ? s.costumes : s.props;
      return items.some(i => i.name === name);
    });
    
    // 🌟 アイテム自体のステータスが揃っているか確認して色をつけます
    let itemStatuses = new Set();
    matchingScenes.forEach(s => {
      const items = typeKey === 'costumes' ? s.costumes : s.props;
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
    summary.innerHTML = `${statusHtml}${name} <span style="font-weight:normal; font-size:12px; color:var(--muted-text); margin-left:auto;">(${matchingScenes.length}件)</span>`;
    details.appendChild(summary);

    const content = document.createElement('div');
    content.className = 'accordion-content';
    
    matchingScenes.sort((a, b) => Number(a.number) - Number(b.number)).forEach(scene => {
      content.appendChild(createSceneCard(scene));
    });
    
    details.appendChild(content);
    listContainer.appendChild(details);
  });
}

function renderSearchResults() {
  const movie = movies.find(m => m.id === currentMovieId);
  const list = document.getElementById('search-result-list');
  list.innerHTML = '';

  if(!movie || movie.scenes.length === 0) {
    list.innerHTML = '<p class="scene-info">まだシーンがありません。</p>';
    return;
  }

  let displayScenes = [...movie.scenes];

  const filterNum = document.getElementById('search-number').value;
  const filterLoc = document.getElementById('search-location').value;
  const filterDate = document.getElementById('search-date').value;
  const filterCos = document.getElementById('search-costume').value;
  const filterProp = document.getElementById('search-prop').value;

  if(filterNum) displayScenes = displayScenes.filter(s => s.number === filterNum);
  if(filterLoc) displayScenes = displayScenes.filter(s => s.location === filterLoc);
  if(filterDate) displayScenes = displayScenes.filter(s => s.date === filterDate);
  if(filterCos) displayScenes = displayScenes.filter(s => s.costumes.some(c => c.name === filterCos));
  if(filterProp) displayScenes = displayScenes.filter(s => s.props.some(p => p.name === filterProp));

  displayScenes.sort((a, b) => Number(a.number) - Number(b.number));

  displayScenes.forEach(scene => list.appendChild(createSceneCard(scene)));
  if(displayScenes.length === 0) list.innerHTML = '<p class="scene-info">条件に合うシーンが見つかりませんでした。</p>';
}

function renderMovie() {
  const movie = movies.find(m => m.id === currentMovieId);
  const list = document.getElementById('scene-list');
  list.innerHTML = '';

  if(!movie || movie.scenes.length === 0) {
    list.innerHTML = '<p class="scene-info">まだシーンがありません。</p>';
    return;
  }

  if (currentViewMode === 'cos') {
    renderInventory(movie, list, 'costumes');
  } else if (currentViewMode === 'prop') {
    renderInventory(movie, list, 'props');
  } else {
    let displayScenes = [...movie.scenes];

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
  }
}

// 🌟 シーンの「見るだけ（View）」の画面を作る魔法です
function renderSceneViewDetail() {
  const movie = movies.find(m => m.id === currentMovieId);
  const scene = movie.scenes.find(s => s.id === currentSceneId);
  if(!scene) return;

  let titleText = `シーン ${scene.number}`;
  if(scene.sceneName) titleText += ` ｜ ${scene.sceneName}`;
  document.getElementById('view-scene-header').textContent = titleText;
  
  let infoText = `場所: ${scene.location || '未定'} ｜ 撮影日: ${scene.date || '未定'}`;
  document.getElementById('view-scene-info').textContent = infoText;

  const cList = document.getElementById('view-scene-costumes');
  cList.innerHTML = '';
  if(scene.costumes.length > 0) {
    let html = `<strong style="color: #c2185b;">[衣装]</strong><br>`;
    scene.costumes.forEach(c => {
      html += `<div style="padding: 8px; border-left: 2px solid #ccc; margin-bottom: 4px; background: rgba(0,0,0,0.02);">
        <span class="status-color status-${c.status}" style="padding:2px 4px; font-size:11px;">${c.status}</span> 
        <strong>${c.name}</strong>
        ${c.desc ? `<div class="scene-info" style="margin-top: 2px;">${c.desc}</div>` : ''}
        ${c.price ? `<div class="scene-info" style="color:#888;">${c.price}</div>` : ''}
      </div>`;
    });
    cList.innerHTML = html;
  }

  const pList = document.getElementById('view-scene-props');
  pList.innerHTML = '';
  if(scene.props.length > 0) {
    let html = `<strong style="color: #1976d2;">[小道具]</strong><br>`;
    scene.props.forEach(p => {
      html += `<div style="padding: 8px; border-left: 2px solid #ccc; margin-bottom: 4px; background: rgba(0,0,0,0.02);">
        <span class="status-color status-${p.status}" style="padding:2px 4px; font-size:11px;">${p.status}</span> 
        <strong>${p.name}</strong>
        ${p.desc ? `<div class="scene-info" style="margin-top: 2px;">${p.desc}</div>` : ''}
        ${p.price ? `<div class="scene-info" style="color:#888;">${p.price}</div>` : ''}
      </div>`;
    });
    pList.innerHTML = html;
  }
}

// 🌟 シーンの「編集（Edit）」の画面を作る魔法です
function renderSceneEditDetail() {
  const movie = movies.find(m => m.id === currentMovieId);
  const scene = movie.scenes.find(s => s.id === currentSceneId);
  if(!scene) return;
  
  document.getElementById('edit-scene-number').value = scene.number || '';
  document.getElementById('edit-scene-name').value = scene.sceneName || '';
  document.getElementById('edit-scene-location').value = scene.location || '';
  setDialDate('ed', scene.date);

  const cList = document.getElementById('edit-costume-list');
  cList.innerHTML = '';
  scene.costumes.forEach(c => addCostumeInput('edit-costume-list', c));

  const pList = document.getElementById('edit-prop-list');
  pList.innerHTML = '';
  scene.props.forEach(p => addPropInput('edit-prop-list', p));
}

function saveEditedScene() {
  if(!currentSceneId) return;
  const movie = movies.find(m => m.id === currentMovieId);
  const scene = movie.scenes.find(s => s.id === currentSceneId);
  
  scene.number = document.getElementById('edit-scene-number').value;
  scene.sceneName = document.getElementById('edit-scene-name').value;
  scene.location = document.getElementById('edit-scene-location').value;
  scene.date = getDialDate('ed'); 
  
  scene.costumes = collectItemsFromDOM('edit-costume-list');
  scene.props = collectItemsFromDOM('edit-prop-list');

  saveMovie(movie); 
  populateSearchFilters();
  
  // 保存したあとは、閲覧モードに戻るようにしました！
  cancelSceneEdit();
  alert('シーンの変更を保存しました。');
}

window.toggleDarkMode = toggleDarkMode;
window.updateDays = updateDays;
window.checkSceneInput = checkSceneInput;
window.updateSelectColor = updateSelectColor;
window.scrollToTop = scrollToTop;
window.goHome = goHome;
window.goMovie = goMovie;
window.goMovieDetails = goMovieDetails;
window.saveMovieDetails = saveMovieDetails;
window.deleteMovieFromDetails = deleteMovieFromDetails;
window.goSearch = goSearch;
window.backFromSearch = backFromSearch;
window.goScene = goScene;
window.openSceneEdit = openSceneEdit;
window.cancelSceneEdit = cancelSceneEdit;
window.closeSceneDetail = closeSceneDetail;
window.addMovie = addMovie;
window.deleteMovie = deleteMovie;
window.editMovieTitle = editMovieTitle;
window.toggleParticipation = toggleParticipation;
window.handleExcelUpload = handleExcelUpload;
window.changeGlobalCalMonth = changeGlobalCalMonth;
window.showDailyScenes = showDailyScenes;
window.addScene = addScene;
window.deleteScene = deleteScene;
window.toggleSceneSelection = toggleSceneSelection;
window.deleteSelectedScenes = deleteSelectedScenes;
window.setViewMode = setViewMode;
window.updateSort = updateSort;
window.addCostumeInput = addCostumeInput;
window.addPropInput = addPropInput;
window.autoFillItem = autoFillItem;
window.saveEditedScene = saveEditedScene;
window.clearSearch = clearSearch;
window.renderSearchResults = renderSearchResults;