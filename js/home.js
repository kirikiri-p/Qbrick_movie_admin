// ホーム画面: 映画一覧（撮影進捗率つき）と参加中スケジュールのカレンダー。
import { state } from './state.js';
import {
  escapeHtml, getParticipation, setParticipation, getSceneOverallStatus
} from './utils.js';
import { goMovie, goMovieDetails, showDailyScenes } from './nav.js';

export function toggleParticipation(movieId) {
  setParticipation(movieId, !getParticipation(movieId));
  renderHome();
}

export function changeGlobalCalMonth(diff) {
  state.globalCalMonth += diff;
  if (state.globalCalMonth < 0) { state.globalCalMonth = 11; state.globalCalYear--; }
  if (state.globalCalMonth > 11) { state.globalCalMonth = 0; state.globalCalYear++; }
  renderHome();
}

export function renderHome() {
  renderGlobalCalendar();
  const list = document.getElementById('movie-list');
  list.innerHTML = '';

  if (state.movies.length === 0) {
    list.innerHTML = '<p class="scene-info">まだ登録された映画がありません</p>';
    return;
  }

  state.movies.forEach((movie) => {
    const div = document.createElement('div');
    div.className = 'card movie-list-item';

    const isPart = getParticipation(movie.id);
    const toggleText = isPart ? '参加' : '非参加';
    let detailText = `${movie.scenes.length}件のシーン`;
    if (movie.director) detailText += ` ｜ 監督: ${escapeHtml(movie.director)}`;
    if (movie.year) detailText += ` ｜ ${escapeHtml(movie.year)}年`;
    const icon = escapeHtml(movie.icon || '🎬');

    // ★新機能: 撮影進捗率（撮影済みシーン数 / 全シーン数）
    const totalScenes = movie.scenes.length;
    const shotScenes = movie.scenes.filter((s) => s.status === '撮影済み').length;
    const progressPct = totalScenes > 0 ? Math.round((shotScenes / totalScenes) * 100) : 0;
    const progressHtml = totalScenes > 0 ? `
      <div class="scene-info" style="margin-left: 12px; margin-top: 4px;">
        撮影進捗: <strong>${progressPct}%</strong>（${shotScenes}/${totalScenes}シーン撮影済み）
        <div class="progress-track" style="max-width: 240px;">
          <div class="progress-fill" style="width: ${progressPct}%;"></div>
        </div>
      </div>` : '';

    div.innerHTML = `
      <div class="movie-info">
        <strong>${icon} ${movie.type ? `[${escapeHtml(movie.type)}] ` : ''}${escapeHtml(movie.title)}</strong>
        <div class="scene-info" style="margin-left: 12px; margin-top: 0;">${detailText}</div>
        ${progressHtml}
      </div>
      <div class="movie-actions">
        <label class="switch-container">
          <span class="switch-label">${toggleText}</span>
          <div class="switch">
            <input type="checkbox" class="part-toggle" ${isPart ? 'checked' : ''}>
            <span class="slider"></span>
          </div>
        </label>
        <button class="edit-title-btn editor-only">編集</button>
      </div>
    `;

    div.querySelector('.movie-info').addEventListener('click', () => goMovie(movie.id));
    div.querySelector('.switch-container').addEventListener('click', (e) => e.stopPropagation());
    div.querySelector('.part-toggle').addEventListener('change', () => toggleParticipation(movie.id));
    div.querySelector('.edit-title-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      goMovieDetails(movie.id);
    });

    list.appendChild(div);
  });
}

export function renderGlobalCalendar() {
  const container = document.getElementById('global-calendar');
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'cal-header';

  const prevBtn = document.createElement('button');
  prevBtn.innerHTML = '&lt; 前月';
  prevBtn.addEventListener('click', () => changeGlobalCalMonth(-1));

  const title = document.createElement('strong');
  title.textContent = `${state.globalCalYear}年 ${state.globalCalMonth + 1}月`;

  const nextBtn = document.createElement('button');
  nextBtn.innerHTML = '次月 &gt;';
  nextBtn.addEventListener('click', () => changeGlobalCalMonth(1));

  header.append(prevBtn, title, nextBtn);
  container.appendChild(header);

  const table = document.createElement('table');
  table.className = 'calendar-table';
  table.innerHTML = '<tr><th>日</th><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th><th>土</th></tr>';

  const firstDay = new Date(state.globalCalYear, state.globalCalMonth, 1).getDay();
  const daysInMonth = new Date(state.globalCalYear, state.globalCalMonth + 1, 0).getDate();

  let tr = document.createElement('tr');
  for (let i = 0; i < firstDay; i++) tr.appendChild(document.createElement('td'));

  const activeScenes = [];
  state.movies.forEach((m) => {
    if (getParticipation(m.id)) m.scenes.forEach((s) => activeScenes.push({ movie: m, scene: s }));
  });

  for (let day = 1; day <= daysInMonth; day++) {
    if (tr.children.length === 7) { table.appendChild(tr); tr = document.createElement('tr'); }
    const td = document.createElement('td');

    const dateStr = `${state.globalCalYear}-${('0' + (state.globalCalMonth + 1)).slice(-2)}-${('0' + day).slice(-2)}`;
    // 日付は保存時に正規化済みなので、完全一致だけで判定できる
    const dayScenes = activeScenes.filter((item) => item.scene.dates && item.scene.dates.includes(dateStr));

    if (dayScenes.length > 0) {
      td.style.cursor = 'pointer';
      td.style.backgroundColor = 'rgba(25, 118, 210, 0.05)';
      td.addEventListener('click', () => showDailyScenes(dateStr));

      const icons = new Set();
      dayScenes.forEach((item) => icons.add(item.movie.icon || '🎬'));
      // セルからあふれないように絵文字は2つまでに抑える
      const iconArr = Array.from(icons);
      const iconText = iconArr.slice(0, 2).join('') + (iconArr.length > 2 ? '…' : '');

      td.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="cal-day-num">${day}</span>
        <span style="font-size:12px; overflow:hidden; white-space:nowrap;">${escapeHtml(iconText)}</span>
      </div>`;

      const dotContainer = document.createElement('div');
      dotContainer.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px; justify-content:flex-start; margin-top:4px;';

      // ドットも上限を設けて、超過分は「+n」でまとめる
      const MAX_DOTS = 6;
      dayScenes.slice(0, MAX_DOTS).forEach((item) => {
        let overall = getSceneOverallStatus(item.scene);
        if (item.scene.status === '撮影済み') overall = 'used';
        const dot = document.createElement('span');
        dot.className = `cal-status-circle cal-bg-${overall}`;
        dotContainer.appendChild(dot);
      });
      if (dayScenes.length > MAX_DOTS) {
        const more = document.createElement('span');
        more.className = 'cal-more';
        more.textContent = `+${dayScenes.length - MAX_DOTS}`;
        dotContainer.appendChild(more);
      }
      td.appendChild(dotContainer);
    } else {
      td.innerHTML = `<span class="cal-day-num">${day}</span>`;
    }
    tr.appendChild(td);
  }
  while (tr.children.length < 7) tr.appendChild(document.createElement('td'));
  table.appendChild(tr);
  container.appendChild(table);
}
