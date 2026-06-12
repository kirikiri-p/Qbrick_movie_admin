// 日々スケジュール（香盤表）のたたき台生成。
// 日別画面のシーンから撮影順序とタイムテーブルを組み立て、
// リポジトリ内のテンプレート(daily_schedule_template.xlsx)に書き込んでダウンロードする。
// テンプレートの書式を保持するため、生成時にExcelJSを遅延読み込みして使う。
import { state } from './state.js';
import { getParticipation } from './utils.js';
import { showToast } from './toast.js';

const TEMPLATE_PATH = 'daily_schedule_template.xlsx';
const EXCELJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';

// テンプレート上の本表エリア（時間×場所×S#×場面…）は8〜37行目の30行
const TABLE_FIRST_ROW = 8;
const TABLE_ROW_COUNT = 30;

const LOAD_MIN = 15;     // 集合〜出発（機材詰込み）の想定時間
const WRAPUP_MIN = 30;   // 撮影終了〜解散（片付け）の想定時間

// ---- 日の出・日の入（熊本基準のNOAA系近似計算、誤差±1分程度） ----------------
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
    const local = (UT + 9) % 24; // JST
    let hh = Math.floor(local);
    let mm = Math.round((local - hh) * 60);
    if (mm === 60) { hh += 1; mm = 0; }
    return `${hh}:${('0' + mm).slice(-2)}`;
  };

  return { sunrise: calc(true), sunset: calc(false) };
}

// ---- 時刻ヘルパー -----------------------------------------------------------
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

// ---- 撮影順序の決定 -----------------------------------------------------------
// 時間帯 M(朝)→D(昼)→未設定→E(夕)→N(夜) の順。
// 同じ時間帯の中では同じ場所のシーンをまとめ、直前の場所から続けられる場合は
// その場所を先頭にして移動回数を最小化する。
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

    // 場所ごとにグループ化（シーン番号順の初出順を維持）
    const groups = new Map();
    zoneScenes.forEach((s) => {
      const loc = s.location || '';
      if (!groups.has(loc)) groups.set(loc, []);
      groups.get(loc).push(s);
    });

    let locs = Array.from(groups.keys());
    // 直前の場所と同じグループがあれば先頭に持ってくる（時間帯をまたぐ移動を節約）
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

// ---- タイムテーブルの組み立て ---------------------------------------------------
// 戻り値: { rows, shootStart, shootEnd }
// row: { time, location, number, name, zone, memo } もしくは { time, name }（定型行）
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
      rows.push({ time: fmtRange(t, t + settings.moveMin), name: `移動（${from}→${to}）・撮影準備` });
      t += settings.moveMin;
      currentLoc = loc;
      insertLunchIfNeeded();
    }

    if (shootStart === null) shootStart = t;
    rows.push({
      time: fmtRange(t, t + settings.sceneMin),
      location: loc,
      number: scene.number,
      name: scene.sceneName || '',
      zone: scene.timeZone || '',
      memo: scene.memo ? String(scene.memo).split('\n')[0].slice(0, 30) : ''
    });
    t += settings.sceneMin;
  });

  const shootEnd = t;
  rows.push({ time: fmtMin(t), name: '撮影終了' });
  rows.push({ time: fmtRange(t, t + WRAPUP_MIN), name: '片付け・機材運搬・解散' });

  return { rows, shootStart: shootStart ?? toMin(settings.meetTime), shootEnd };
}

// ---- ExcelJSの遅延読み込み ------------------------------------------------------
let excelJsPromise = null;
function loadExcelJS() {
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

// ---- ダイアログの開閉 ------------------------------------------------------------
let dialogDate = null;

function getDailyMovies(dateStr) {
  // その日に撮影予定シーンがある参加中の映画
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

// ---- 生成本体 --------------------------------------------------------------------
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
    // テンプレートとExcelJSを並行で取得
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

    // ---- 上部ヘッダー ----
    const [y, m, d] = dialogDate.split('-').map(Number);
    const weekday = ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()];
    const dayPart = settings.dayNum ? `　Day${settings.dayNum}` : '';
    ws.getCell('B2').value = `Qbrick　映画「${movie.title}」日々スケジュール${dayPart}`;
    ws.getCell('B3').value = ` ${m}月${d}日（${weekday}）`;
    if (settings.meetPlace) ws.getCell('G4').value = settings.meetPlace;
    ws.getCell('U4').value = fmtMin(toMin(settings.meetTime)); // スタッフ集合時間
    ws.getCell('V4').value = fmtMin(shootStart);               // 撮影開始時間
    ws.getCell('X4').value = fmtMin(shootEnd);                 // 撮影終了予定時間
    ws.getCell('AB4').value = sun.sunrise;                     // 日の出
    ws.getCell('AB5').value = sun.sunset;                      // 日の入

    // ---- 本表（時間 / 場所 / S# / 場面 / D/N / 備考） ----
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
        if (row.memo) ws.getCell(`U${r}`).value = row.memo;
      } else {
        ws.getCell(`E${r}`).value = row.name || '';
      }
    }
    if (rows.length > TABLE_ROW_COUNT) {
      ws.getCell(`E${TABLE_FIRST_ROW + TABLE_ROW_COUNT - 1}`).value = '※行数が足りないため以降は省略（シーン数を確認してください）';
    }

    // ---- ダウンロード ----
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
