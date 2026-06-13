// 共通ユーティリティ。DOMにもFirebaseにも依存しない純粋な関数のみ。

// ---- セキュリティ: HTMLエスケープ --------------------------------------
// ユーザー入力（シーン名・場所・メモ・衣装名など）をinnerHTMLに埋め込む前に必ず通す。
// これにより「<」や「"」を含む入力で表示が壊れる/スクリプトが注入される問題を防ぐ。
const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

// ステータスはCSSクラス名にも使うため、既知の値だけを通す（クラス属性への注入防止）
export const ITEM_STATUSES = ['未着手', '準備中', '準備完了', '使用済み'];
export function safeStatus(status) {
  return ITEM_STATUSES.includes(status) ? status : '未着手';
}

// メモ内のURLをリンク化する。先にエスケープしてから置換するので安全。
export function linkify(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #1976d2; text-decoration: underline;">${url}</a>`
  );
}

// ---- 日付 ----------------------------------------------------------------
export function getNowFormattedString() {
  const now = new Date();
  const p = (n) => ('0' + n).slice(-2);
  return `${now.getFullYear()}/${p(now.getMonth() + 1)}/${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
}

// あらゆる表記の日付文字列を「YYYY-MM-DD」へ正規化する。
// 例: 2026/1/5, 2026-1-5, 2026年1月5日 → 2026-01-05
// 解釈できない文字列はそのまま返す（データを壊さない）。
export function normalizeDateStr(value) {
  if (!value) return '';
  const s = String(value).trim();
  const m = s.match(/^(\d{4})[\/\-年.](\d{1,2})[\/\-月.](\d{1,2})日?$/);
  if (!m) return s;
  return `${m[1]}-${('0' + m[2]).slice(-2)}-${('0' + m[3]).slice(-2)}`;
}

// Excelのシリアル値・文字列日付を YYYY-MM-DD に変換
export function parseExcelDate(serial) {
  if (!serial && serial !== 0) return '';
  if (typeof serial === 'number') {
    const utcDays = Math.floor(serial - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
  }
  return normalizeDateStr(serial);
}

export function migrateMovieData(data) {
  if (!Array.isArray(data.directors)) {
    data.directors = data.director ? [String(data.director)] : [];
  }
  if (!Array.isArray(data.cast)) data.cast = [];
  return data;
}

// ---- データ移行 -----------------------------------------------------------
// 古い形式のシーンデータを現行形式へ変換しつつ、日付も正規化する。
export function migrateSceneData(scene) {
  if (scene.date && !scene.dates) { scene.dates = [scene.date]; } else if (!scene.dates) { scene.dates = []; }
  scene.dates = scene.dates.map(normalizeDateStr).filter((d) => d);

  if (!scene.costumes) {
    scene.costumes = [];
    if (scene.costumeName) {
      scene.costumeName.split(',').forEach((n, i) => {
        if (n.trim()) scene.costumes.push({ id: 'c' + Date.now() + i, name: n.trim(), status: scene.costumeStatus || '未着手', desc: scene.costumeDesc || '', price: scene.costumePrice || '' });
      });
    }
  }
  if (!scene.props) {
    scene.props = [];
    if (scene.propName) {
      scene.propName.split(',').forEach((n, i) => {
        if (n.trim()) scene.props.push({ id: 'p' + Date.now() + i, name: n.trim(), status: scene.propStatus || '未着手', desc: scene.propDesc || '', price: scene.propPrice || '' });
      });
    }
  }
  if (!Array.isArray(scene.characters)) scene.characters = [];
  if (!scene.memo) scene.memo = '';
  if (!scene.status) scene.status = '未撮影';
  if (!scene.timeZone) scene.timeZone = '';
  if (!scene.updatedAt) scene.updatedAt = '';

  scene.costumes.forEach((c) => { if (c.status === '使用済み') c.status = '準備完了'; });
  scene.props.forEach((p) => { if (p.status === '使用済み') p.status = '準備完了'; });

  return scene;
}

// ---- 共通の集計ロジック ----------------------------------------------------
export function getSceneOverallStatus(scene) {
  const items = [...(scene.costumes || []), ...(scene.props || [])];
  if (items.length === 0) return 'none';
  let hasAlert = false;
  let allReady = true;
  items.forEach((i) => {
    if (i.status === '未着手' || i.status === '準備中') hasAlert = true;
    if (i.status !== '準備完了') allReady = false;
  });
  if (hasAlert) return 'alert';
  if (allReady) return 'ready';
  return 'none';
}

// 同名アイテムのステータス・詳細・金額を全シーンに同期する。
// （注意: data は Firestore から読み直した最新の映画データを渡すこと）
export function syncItemStatuses(movieData, updatedItems, typeKey) {
  updatedItems.forEach((updatedItem) => {
    (movieData.scenes || []).forEach((scene) => {
      const items = scene[typeKey] || [];
      items.forEach((item) => {
        if (item.name === updatedItem.name) {
          item.status = updatedItem.status;
          item.desc = updatedItem.desc;
          item.price = updatedItem.price;
        }
      });
    });
  });
}

// ---- 参加フラグ（端末ローカル） --------------------------------------------
export function getParticipation(movieId) {
  return localStorage.getItem('part_' + movieId) === 'true';
}
export function setParticipation(movieId, value) {
  localStorage.setItem('part_' + movieId, value ? 'true' : 'false');
}
export function removeParticipation(movieId) {
  localStorage.removeItem('part_' + movieId);
}
