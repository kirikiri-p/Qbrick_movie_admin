import { state } from './state.js';
import { parseExcelDate, getNowFormattedString, safeStatus } from './utils.js';
import { createMovie } from './firebase.js';
import { showToast } from './toast.js';
import { loadExcelJS } from './callsheet.js';

const DELIMITER = '|';

function splitCell(value) {
  if (value === undefined || value === null || value === '') return [];
  const s = String(value);
  const delim = s.includes('\n') ? '\n' : (s.includes(DELIMITER) ? DELIMITER : ',');
  return s.split(delim);
}

function parseCharEntry(entry) {
  const t = String(entry).trim();
  const m = t.match(/^(.*?)[（(](.*)[）)]\s*$/);
  if (m) return { character: m[1].trim(), actor: m[2].trim() };
  return { character: t, actor: '' };
}

export function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();

  reader.onload = async function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const rows = json.slice(1);
      const newScenes = [];

      const castMap = new Map();

      rows.forEach((row, index) => {
        if (!row || row.length === 0) return;
        const number = String(row[0] ?? '');
        const rawDate = parseExcelDate(row[1]);
        const dates = rawDate ? String(rawDate).split(',').map((d) => parseExcelDate(d.trim())).filter((d) => d) : [];
        const sceneName = String(row[2] ?? '');
        const location = String(row[3] ?? '');

        const cStats = splitCell(row[4]);
        const cNames = splitCell(row[5]);
        const cDescs = splitCell(row[6]);
        const cPrices = splitCell(row[7]);
        const cChars = splitCell(row[16]);
        const cParts = splitCell(row[17]);
        const costumes = cNames.map((n, i) => ({
          id: 'c' + Date.now() + i + Math.random(),
          name: n.trim(),
          status: safeStatus((cStats[i] || '未着手').trim()),
          desc: (cDescs[i] || '').trim(),
          price: (cPrices[i] || '').trim(),
          character: (cChars[i] || '').trim(),
          parts: (cParts[i] || '').split('・').map((x) => x.trim()).filter(Boolean)
        })).filter((c) => c.name);

        const pStats = splitCell(row[8]);
        const pNames = splitCell(row[9]);
        const pDescs = splitCell(row[10]);
        const pPrices = splitCell(row[11]);
        const props = pNames.map((n, i) => ({
          id: 'p' + Date.now() + i + Math.random(),
          name: n.trim(),
          status: safeStatus((pStats[i] || '未着手').trim()),
          desc: (pDescs[i] || '').trim(),
          price: (pPrices[i] || '').trim()
        })).filter((p) => p.name);

        const status = String(row[12] ?? '').trim() === '撮影済み' ? '撮影済み' : '未撮影';
        const timeZone = String(row[13] ?? '').trim();
        const memo = String(row[14] ?? '');
        const charEntries = splitCell(row[15]).map(parseCharEntry).filter((e) => e.character);
        const characters = charEntries.map((e) => e.character);

        charEntries.forEach((e) => {
          if (!castMap.has(e.character) || (!castMap.get(e.character) && e.actor)) {
            castMap.set(e.character, e.actor);
          }
        });

        const existing = newScenes.find((s) => s.number === number && s.sceneName === sceneName && s.location === location);
        if (existing) {
          if (costumes.length > 0) existing.costumes.push(...costumes);
          if (props.length > 0) existing.props.push(...props);
          dates.forEach((d) => { if (!existing.dates.includes(d)) existing.dates.push(d); });
          characters.forEach((c) => { if (!existing.characters.includes(c)) existing.characters.push(c); });
        } else {
          newScenes.push({
            id: Date.now() + index, number, dates, sceneName, location,
            characters, costumes, props,
            status, timeZone, memo, updatedAt: getNowFormattedString()
          });
        }
      });

      const movieTitle = file.name.replace(/\.[^/.]+$/, '');
      const cast = Array.from(castMap, ([character, actor]) => ({ character, actor }));
      const newMovie = { id: Date.now(), title: movieTitle, scenes: newScenes, type: '', directors: [], year: '', icon: '🎬', cast };
      await createMovie(newMovie);
      showToast(movieTitle + ' のデータを読み込みました');
    } catch (err) {
      console.error(err);
      alert('Excelの読み込みに失敗しました。ファイル形式を確認してください。');
    } finally {
      document.getElementById('excel-upload').value = '';
    }
  };
  reader.readAsArrayBuffer(file);
}

function thinBorder() {
  const s = { style: 'thin', color: { argb: 'FFCCCCCC' } };
  return { top: s, bottom: s, left: s, right: s };
}

const STATUS_FILL = {
  '未着手': 'FFFDE7E7',
  '準備中': 'FFFFF3E0',
  '準備完了': 'FFE8F5E9'
};

export async function exportToExcel() {
  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  if (!movie) return;

  try {
    await loadExcelJS();
    const wb = new window.ExcelJS.Workbook();
    const ws = wb.addWorksheet('シーン一覧', { views: [{ state: 'frozen', ySplit: 1 }] });

    const cols = [
      { header: 'シーン番号', width: 10 },
      { header: '撮影日', width: 13 },
      { header: 'シーン名', width: 18 },
      { header: '場所', width: 18 },
      { header: '衣装ステータス', width: 11 },
      { header: '衣装名', width: 16 },
      { header: '衣装詳細', width: 22 },
      { header: '衣装 金額/メモ', width: 12 },
      { header: '小道具ステータス', width: 11 },
      { header: '物品名', width: 16 },
      { header: '小道具詳細', width: 22 },
      { header: '小道具 金額/メモ', width: 12 },
      { header: '撮影', width: 9 },
      { header: '時間帯', width: 7 },
      { header: 'メモ', width: 26 },
      { header: '登場人物', width: 18 },
      { header: '誰の衣装', width: 14 },
      { header: '衣装パーツ', width: 20 }
    ];
    ws.columns = cols.map((c) => ({ width: c.width }));

    const headerRow = ws.addRow(cols.map((c) => c.header));
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = thinBorder();
    });

    const actorOf = {};
    (movie.cast || []).forEach((c) => { if (c.character) actorOf[c.character] = c.actor || ''; });
    const flat = (v) => String(v ?? '').replace(/\r?\n/g, ' ');
    const col = (items, key) => (items || []).map((i) => flat(i[key])).join('\n');

    movie.scenes
      .slice()
      .sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true, sensitivity: 'base' }))
      .forEach((s) => {
        const charStr = (s.characters || []).map((n) => (actorOf[n] ? `${n}（${actorOf[n]}）` : n)).join('\n');
        const cosChar = (s.costumes || []).map((c) => flat(c.character || '')).join('\n');
        const cosParts = (s.costumes || []).map((c) => (c.parts || []).join('・')).join('\n');

        const row = ws.addRow([
          s.number, (s.dates || []).join(','), s.sceneName || '', s.location || '',
          col(s.costumes, 'status'), col(s.costumes, 'name'), col(s.costumes, 'desc'), col(s.costumes, 'price'),
          col(s.props, 'status'), col(s.props, 'name'), col(s.props, 'desc'), col(s.props, 'price'),
          s.status || '未撮影', s.timeZone || '', s.memo || '', charStr, cosChar, cosParts
        ]);
        row.alignment = { vertical: 'top', wrapText: true };
        row.eachCell((cell) => { cell.border = thinBorder(); });

        const shotCell = row.getCell(13);
        if (s.status === '撮影済み') {
          shotCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
          shotCell.font = { color: { argb: 'FF1976D2' }, bold: true };
        }
        const fill = STATUS_FILL[safeStatus((s.costumes && s.costumes[0] && s.costumes[0].status) || '未着手')];
        if (fill) row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${movie.title}_シーン一覧.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showToast('Excelを書き出しました');
  } catch (e) {
    console.error(e);
    alert('Excelの書き出しに失敗しました。通信環境を確認してください。');
  }
}
