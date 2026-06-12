// Excel インポート / エクスポート。
// ポイント: 衣装・小道具の複数項目を1セルにまとめる際の区切り文字をカンマから「|」に変更。
// 「1,500円」のようにカンマを含む値があっても列の対応がズレなくなった。
// インポート時はセルに「|」が含まれていれば新形式、なければ旧形式（カンマ区切り）として
// 自動判別するので、過去にエクスポートしたファイルもそのまま読み込める。
/* global XLSX */
import { state } from './state.js';
import { parseExcelDate, getNowFormattedString, safeStatus } from './utils.js';
import { createMovie } from './firebase.js';

const DELIMITER = '|';

// 新旧形式を自動判別して分割
function splitCell(value) {
  if (value === undefined || value === null || value === '') return [];
  const s = String(value);
  const delim = s.includes(DELIMITER) ? DELIMITER : ',';
  return s.split(delim);
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
        const costumes = cNames.map((n, i) => ({
          id: 'c' + Date.now() + i + Math.random(),
          name: n.trim(),
          status: safeStatus((cStats[i] || '未着手').trim()),
          desc: (cDescs[i] || '').trim(),
          price: (cPrices[i] || '').trim()
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

        const existing = newScenes.find((s) => s.number === number && s.sceneName === sceneName && s.location === location);
        if (existing) {
          if (costumes.length > 0) existing.costumes.push(...costumes);
          if (props.length > 0) existing.props.push(...props);
          dates.forEach((d) => { if (!existing.dates.includes(d)) existing.dates.push(d); });
        } else {
          newScenes.push({
            id: Date.now() + index, number, dates, sceneName, location,
            costumes, props, status: '未撮影', updatedAt: getNowFormattedString()
          });
        }
      });

      const movieTitle = file.name.replace(/\.[^/.]+$/, '');
      const newMovie = { id: Date.now(), title: movieTitle, scenes: newScenes, type: '', director: '', year: '', icon: '🎬' };
      await createMovie(newMovie);
      alert(movieTitle + ' のデータを読み込みました');
    } catch (err) {
      console.error(err);
      alert('Excelの読み込みに失敗しました。ファイル形式を確認してください。');
    } finally {
      document.getElementById('excel-upload').value = '';
    }
  };
  reader.readAsArrayBuffer(file);
}

export function exportToExcel() {
  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  if (!movie) return;
  const aoa = [['シーン番号', '撮影日', 'シーン名', '場所', '衣装ステータス', '衣装名', '衣装詳細', '金額/メモ', '小道具ステータス', '物品名', '小道具詳細', '金額/メモ']];

  movie.scenes.forEach((s) => {
    const dateStr = s.dates ? s.dates.join(',') : '';
    const join = (items, key) => (items || []).map((i) => i[key] ?? '').join(DELIMITER);

    aoa.push([
      s.number, dateStr, s.sceneName, s.location,
      join(s.costumes, 'status'), join(s.costumes, 'name'), join(s.costumes, 'desc'), join(s.costumes, 'price'),
      join(s.props, 'status'), join(s.props, 'name'), join(s.props, 'desc'), join(s.props, 'price')
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Scenes');
  XLSX.writeFile(wb, `${movie.title}_シーン一覧.xlsx`);
}
