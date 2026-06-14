const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');

// ★Firestoreのロケーションに合わせて変更してください。
//   Firebaseコンソール → Firestore Database → 「ロケーション」で確認できます。
//   例: 東京=asia-northeast1 / 米国(nam5)=us-central1 など。
const REGION = 'asia-northeast1';

const NOTION_TOKEN = defineSecret('NOTION_TOKEN');
const NOTION_DB = defineSecret('NOTION_DB');

const NOTION_VERSION = '2022-06-28';

setGlobalOptions({ region: REGION });

async function notion(token, path, method, body) {
  const res = await fetch('https://api.notion.com/v1' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Notion ${method} ${path} -> ${res.status} ${t}`);
  }
  return res.json();
}

function rt(text) {
  const s = (text === undefined || text === null) ? '' : String(text);
  if (!s) return [];
  return [{ type: 'text', text: { content: s.slice(0, 1900) } }];
}

function itemsText(items) {
  return (items || []).map((i) => {
    let s = `${i.status || ''} ${i.name || ''}`.trim();
    if (i.character) s += `（${i.character}）`;
    if (i.parts && i.parts.length) s += ` [${i.parts.join('・')}]`;
    if (i.price) s += ` ¥${i.price}`;
    return '・' + s;
  }).join('\n');
}

function sceneKey(movieId, sceneId) {
  return `${movieId}::${sceneId}`;
}

function buildProps(movieId, movieTitle, scene) {
  const title = `シーン ${scene.number || ''}${scene.sceneName ? ' ' + scene.sceneName : ''}`.trim();
  return {
    '名前': { title: rt(title || '（無題）') },
    'Key': { rich_text: rt(sceneKey(movieId, scene.id)) },
    'MovieKey': { rich_text: rt(String(movieId)) },
    '映画': { rich_text: rt(movieTitle) },
    'シーン番号': { rich_text: rt(scene.number) },
    '場所': { rich_text: rt(scene.location) },
    '撮影日': { rich_text: rt((scene.dates || []).join(', ')) },
    '時間帯': scene.timeZone ? { select: { name: String(scene.timeZone) } } : { select: null },
    '撮影ステータス': { select: { name: scene.status || '未撮影' } },
    '登場人物': { rich_text: rt((scene.characters || []).join('、')) },
    '衣装': { rich_text: rt(itemsText(scene.costumes)) },
    '小道具': { rich_text: rt(itemsText(scene.props)) },
    'メモ': { rich_text: rt(scene.memo) }
  };
}

async function fetchExistingPages(token, dbId, movieId) {
  const map = new Map();
  let cursor;
  do {
    const body = {
      filter: { property: 'MovieKey', rich_text: { equals: String(movieId) } },
      page_size: 100
    };
    if (cursor) body.start_cursor = cursor;
    const data = await notion(token, `/databases/${dbId}/query`, 'POST', body);
    for (const page of data.results) {
      const keyProp = page.properties && page.properties.Key && page.properties.Key.rich_text;
      const key = (keyProp && keyProp[0] && keyProp[0].plain_text) || '';
      if (key) map.set(key, page.id);
    }
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return map;
}

exports.syncMovieToNotion = onDocumentWritten(
  { document: 'movies/{movieId}', secrets: [NOTION_TOKEN, NOTION_DB], timeoutSeconds: 300 },
  async (event) => {
    const token = NOTION_TOKEN.value();
    const dbId = NOTION_DB.value();
    const movieId = event.params.movieId;

    const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
    const existing = await fetchExistingPages(token, dbId, movieId);

    if (!after) {
      for (const pageId of existing.values()) {
        await notion(token, `/pages/${pageId}`, 'PATCH', { archived: true });
      }
      return;
    }

    const movieTitle = after.title || '';
    const scenes = Array.isArray(after.scenes) ? after.scenes : [];
    const keptKeys = new Set();

    for (const scene of scenes) {
      if (!scene || scene.id === undefined || scene.id === null) continue;
      const key = sceneKey(movieId, scene.id);
      keptKeys.add(key);
      const properties = buildProps(movieId, movieTitle, scene);
      const pageId = existing.get(key);
      if (pageId) {
        await notion(token, `/pages/${pageId}`, 'PATCH', { properties });
      } else {
        await notion(token, '/pages', 'POST', { parent: { database_id: dbId }, properties });
      }
    }

    for (const [key, pageId] of existing) {
      if (!keptKeys.has(key)) {
        await notion(token, `/pages/${pageId}`, 'PATCH', { archived: true });
      }
    }
  }
);
