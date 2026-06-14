import { state } from './state.js';
import { getParticipation } from './utils.js';
import { showToast } from './toast.js';

const TEMPLATE_PATH = 'daily_schedule_template.xlsx';
const EXCELJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';

const TABLE_FIRST_ROW = 8;
const TABLE_ROW_COUNT = 30;

const LOAD_MIN = 15;
const WRAPUP_MIN = 30;

export function calcSunTimes(dateStr, lat = 32.79, lon = 130.74) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const N = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
  const rad = Math.PI / 180;
  const zenith = 90.833;

  const calc = (rising) => {
    const lngHour = lon / 15;
    const t = rising ? N + ((6 - lngHour) / 24) : N + ((18 - lngHour) / 24);
    const M = (0.9856 * t) - 3.289;
    let L = M + (1.916 * Math.sin(M * rad)) + (0.020 * Math.sin(2 * M * rad)) + 282.634;
    L = ((L % 360) + 360) % 360;
    let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
    RA = ((RA % 360) + 360) % 360;
    RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
    const sinDec = 0.39782 * Math.sin(L * rad);
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(zenith * rad) - (sinDec * Math.sin(lat * rad))) / (cosDec * Math.cos(lat * rad));
    if (cosH > 1 || cosH < -1) return '';
    let H = rising ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad;
    H /= 15;
    const T = H + RA - (0.06571 * t) - 6.622;
    const UT = ((T - lngHour) % 24 + 24) % 24;
    const local = (UT + 9) % 24;
    let hh = Math.floor(local);
    let mm = Math.round((local - hh) * 60);
    if (mm === 60) { hh += 1; mm = 0; }
    return `${hh}:${('0' + mm).slice(-2)}`;
  };

  return { sunrise: calc(true), sunset: calc(false) };
}

function toMin(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function fmtMin(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${h}:${('0' + m).slice(-2)}`;
}
function fmtRange(start, end) {
  return `${fmtMin(start)}-${fmtMin(end)}`;
}

const ZONE_ORDER = { 'M': 0, 'D': 1, '': 2, 'E': 3, 'N': 4 };

export function orderScenesForShoot(scenes) {
  const byZone = new Map();
  scenes.forEach((s) => {
    const z = ZONE_ORDER.hasOwnProperty(s.timeZone) ? s.timeZone : '';
    if (!byZone.has(z)) byZone.set(z, []);
    byZone.get(z).push(s);
  });

  const zones = Array.from(byZone.keys()).sort((a, b) => ZONE_ORDER[a] - ZONE_ORDER[b]);
  const ordered = [];
  let prevLocation = null;

  zones.forEach((z) => {
    const zoneScenes = byZone.get(z)
      .sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true, sensitivity: 'base' }));

    const groups = new Map();
    zoneScenes.forEach((s) => {
      const loc = s.location || '';
      if (!groups.has(loc)) groups.set(loc, []);
      groups.get(loc).push(s);
    });

    let locs = Array.from(groups.keys());

    if (prevLocation !== null && groups.has(prevLocation)) {
      locs = [prevLocation, ...locs.filter((l) => l !== prevLocation)];
    }

    locs.forEach((loc) => {
      groups.get(loc).forEach((s) => ordered.push(s));
      prevLocation = loc;
    });
  });

  return ordered;
}

export function buildTimeline(scenes, settings) {
  const ordered = orderScenesForShoot(scenes);
  const rows = [];

  let t = toMin(settings.meetTime);
  const meetLabel = settings.meetPlace ? `${settings.meetPlace}集合・機材詰込み` : '集合・機材詰込み';
  rows.push({ time: fmtMin(t), name: meetLabel });
  t += LOAD_MIN;

  let currentLoc = settings.meetPlace || '';
  let lunchDone = !settings.lunchEnabled;
  const lunchStart = toMin(settings.lunchStart || '12:00');
  let shootStart = null;

  const insertLunchIfNeeded = () => {
    if (!lunchDone && t >= lunchStart) {
      rows.push({ time: fmtRange(t, t + settings.lunchMin), name: '昼休憩（各自昼食）' });
      t += settings.lunchMin;
      lunchDone = true;
    }
  };

  ordered.forEach((scene) => {
    insertLunchIfNeeded();

    const loc = scene.location || '';
    if (loc !== currentLoc) {
      const from = currentLoc || '集合場所';
      const to = loc || '次のロケ地';
      rows.push({ time: fmtRange(t, t + settings.moveMin), name: `移動（${from}→${to}）` });
      t += settings.moveMin;
      currentLoc = loc;
      insertLunchIfNeeded();
    }

    rows.push({ time: fmtRange(t, t + settings.prepMin), name: `撮影準備（シーン ${scene.number}）` });
    t += settings.prepMin;
    insertLunchIfNeeded();

    if (shootStart === null) shootStart = t;
    rows.push({
      time: fmtRange(t, t + settings.sceneMin),
      location: loc,
      number: scene.number,
      name: scene.sceneName || '',
      zone: scene.timeZone || '',
      characters: scene.characters || [],
      memo: scene.memo ? String(scene.memo).split('\n')[0].slice(0, 30) : ''
    });
    t += settings.sceneMin;
  });

  const shootEnd = t;
  rows.push({ time: fmtMin(t), name: '撮影終了' });
  rows.push({ time: fmtRange(t, t + WRAPUP_MIN), name: '片付け・機材運搬・解散' });

  return { rows, shootStart: shootStart ?? toMin(settings.meetTime), shootEnd };
}

let excelJsPromise = null;
export function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve();
  if (!excelJsPromise) {
    excelJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = EXCELJS_CDN;
      script.onload = resolve;
      script.onerror = () => {
        excelJsPromise = null;
        reject(new Error('ExcelJSの読み込みに失敗'));
      };
      document.head.appendChild(script);
    });
  }
  return excelJsPromise;
}

let dialogDate = null;

function getDailyMovies(dateStr) {

  return state.movies.filter((m) =>
    getParticipation(m.id) && m.scenes.some((s) => s.dates && s.dates.includes(dateStr))
  );
}

export function openCallsheetDialog() {
  const hash = window.location.hash.replace('#', '');
  dialogDate = hash.startsWith('daily/') ? hash.split('/')[1] : state.renderedDailyDate;
  if (!dialogDate) return;

  const candidates = getDailyMovies(dialogDate);
  if (candidates.length === 0) {
    showToast('この日に撮影予定のシーンがありません');
    return;
  }

  const movieSelect = document.getElementById('cs-movie');
  movieSelect.innerHTML = '';
  candidates.forEach((m) => movieSelect.add(new Option(m.title, m.id)));
  document.getElementById('cs-movie-row').style.display = candidates.length > 1 ? 'block' : 'none';

  document.getElementById('cs-date-label').textContent = `${dialogDate} の日々スケジュール`;
  document.getElementById('callsheet-modal').classList.remove('hidden');
}

export function closeCallsheetDialog() {
  document.getElementById('callsheet-modal').classList.add('hidden');
}

export async function generateCallsheet() {
  if (!dialogDate) return;

  const movieId = parseInt(document.getElementById('cs-movie').value);
  const movie = state.movies.find((m) => m.id === movieId);
  if (!movie) return;

  const settings = {
    dayNum: document.getElementById('cs-day-num').value.trim(),
    meetPlace: document.getElementById('cs-meet-place').value.trim(),
    meetTime: document.getElementById('cs-meet-time').value || '08:30',
    sceneMin: Math.max(5, parseInt(document.getElementById('cs-scene-min').value) || 60),
    moveMin: Math.max(0, parseInt(document.getElementById('cs-move-min').value) || 30),
    prepMin: Math.max(0, parseInt(document.getElementById('cs-prep-min').value) || 30),
    lunchEnabled: document.getElementById('cs-lunch-enabled').checked,
    lunchStart: document.getElementById('cs-lunch-start').value || '12:00',
    lunchMin: Math.max(0, parseInt(document.getElementById('cs-lunch-min').value) || 60),
  };

  const scenes = movie.scenes.filter((s) => s.dates && s.dates.includes(dialogDate));
  if (scenes.length === 0) {
    showToast('選択した映画にはこの日のシーンがありません');
    return;
  }

  try {

    const [templateBuf] = await Promise.all([
      fetch(TEMPLATE_PATH).then((r) => {
        if (!r.ok) throw new Error('テンプレートの取得に失敗: ' + r.status);
        return r.arrayBuffer();
      }),
      loadExcelJS(),
    ]);

    const { rows, shootStart, shootEnd } = buildTimeline(scenes, settings);
    const sun = calcSunTimes(dialogDate);

    const workbook = new window.ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuf);
    const ws = workbook.worksheets[0];

    const [y, m, d] = dialogDate.split('-').map(Number);
    const weekday = ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()];
    const dayPart = settings.dayNum ? `　Day${settings.dayNum}` : '';
    ws.getCell('B2').value = `Qbrick　映画「${movie.title}」日々スケジュール${dayPart}`;
    ws.getCell('B3').value = ` ${m}月${d}日（${weekday}）`;
    if (settings.meetPlace) {
      ws.getCell('G4').value = settings.meetPlace;
      ws.getCell('L4').value = settings.meetPlace;
    }
    ws.getCell('U4').value = fmtMin(toMin(settings.meetTime));
    ws.getCell('V4').value = fmtMin(shootStart);
    ws.getCell('X4').value = fmtMin(shootEnd);
    ws.getCell('AB4').value = sun.sunrise;
    ws.getCell('AB5').value = sun.sunset;

    const CHAR_FIRST_COL = 12;
    const CHAR_COL_COUNT = 9;
    const colLetter = (n) => String.fromCharCode(64 + n);

    const dayCharSet = new Set();
    scenes.forEach((s) => (s.characters || []).forEach((c) => dayCharSet.add(c)));
    const charColumns = [];
    (movie.cast || []).forEach((c) => {
      if (c.character && dayCharSet.has(c.character) && !charColumns.includes(c.character)) charColumns.push(c.character);
    });
    dayCharSet.forEach((name) => { if (!charColumns.includes(name)) charColumns.push(name); });
    const usedCharColumns = charColumns.slice(0, CHAR_COL_COUNT);
    const charColIndex = new Map(usedCharColumns.map((name, i) => [name, CHAR_FIRST_COL + i]));

    usedCharColumns.forEach((name, i) => {
      const L = colLetter(CHAR_FIRST_COL + i);
      try { ws.mergeCells(`${L}6:${L}7`); } catch (e) {  }
      const cell = ws.getCell(`${L}6`);
      cell.value = name;
      cell.alignment = { textRotation: 255, horizontal: 'center', vertical: 'top', wrapText: true };
    });

    if (usedCharColumns.length >= 1) {
      for (let col = CHAR_FIRST_COL + usedCharColumns.length; col <= 20; col++) {
        ws.getColumn(col).hidden = true;
      }
    }

    const GREY = { argb: 'FF8C8C8C' };
    const writable = Math.min(rows.length, TABLE_ROW_COUNT);
    for (let i = 0; i < writable; i++) {
      const r = TABLE_FIRST_ROW + i;
      const row = rows[i];
      ws.getCell(`B${r}`).value = row.time || '';
      if (row.location !== undefined) {
        ws.getCell(`C${r}`).value = row.location || '';
        ws.getCell(`D${r}`).value = row.number ?? '';
        ws.getCell(`E${r}`).value = row.name || '';
        ws.getCell(`I${r}`).value = row.zone || '';

        (row.characters || []).forEach((name) => {
          const ci = charColIndex.get(name);
          if (ci) {
            const cell = ws.getCell(`${colLetter(ci)}${r}`);
            cell.value = '○';
            cell.alignment = { horizontal: 'center', vertical: 'center' };
          }
        });
        if (row.memo) ws.getCell(`U${r}`).value = row.memo;
      } else {
        ws.getCell(`E${r}`).value = row.name || '';

        ['B', 'E'].forEach((col) => {
          const cell = ws.getCell(`${col}${r}`);
          cell.font = { ...(cell.font || {}), color: GREY };
        });
      }
    }
    if (rows.length > TABLE_ROW_COUNT) {
      ws.getCell(`E${TABLE_FIRST_ROW + TABLE_ROW_COUNT - 1}`).value = '※行数が足りないため以降は省略（シーン数を確認してください）';
    }

    const CAST_FIRST_ROW = 8;
    const CAST_ROW_COUNT = 16;
    const castList = movie.cast || [];
    castList.slice(0, CAST_ROW_COUNT).forEach((c, i) => {
      const r = CAST_FIRST_ROW + i;

      ws.getCell(`Y${r}`).value = c.actor ? `${c.character}（${c.actor}）` : c.character;
    });
    if (castList.length > CAST_ROW_COUNT) {
      ws.getCell(`Y${CAST_FIRST_ROW + CAST_ROW_COUNT - 1}`).value = '※人数が多いため一部省略';
    }

    const DEPT_CELL = 'B6';
    const directorText = (movie.directors || []).filter(Boolean).join('、');
    if (DEPT_CELL) {
      const deptLines = [
        `監督：${directorText}`,
        '制作：',
        '撮影：',
        '録音：',
        '照明：',
      ];
      const deptCell = ws.getCell(DEPT_CELL);
      deptCell.value = deptLines.join('\n');
      deptCell.alignment = { ...(deptCell.alignment || {}), wrapText: true, vertical: 'top', horizontal: 'left' };
    }

    if (directorText) {
      ws.getCell('V39').value = `監督：${directorText}`;
    }

    const outBuf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([outBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `日々スケ_${dialogDate}_${movie.title}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    closeCallsheetDialog();
    showToast('日々スケジュールのたたき台を作成しました');
  } catch (e) {
    console.error(e);
    alert('日々スケジュールの作成に失敗しました。通信環境と、リポジトリに daily_schedule_template.xlsx が置かれているかを確認してください。');
  }
}
