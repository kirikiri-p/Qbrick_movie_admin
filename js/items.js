import { state } from './state.js';
import { ITEM_STATUSES, safeStatus } from './utils.js';

export function checkSceneInput() {
  const numInput = document.getElementById('new-scene-number');
  const btn = document.getElementById('add-scene-btn');
  if (!numInput || !btn) return;
  btn.disabled = (numInput.value.trim() === '');
}

export function updateSelectColor(sel) {
  ITEM_STATUSES.forEach((s) => sel.classList.remove('status-' + s));
  sel.classList.add('status-' + safeStatus(sel.value));
}

export function addDateInput(containerId, initDate = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const div = document.createElement('div');
  div.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;';

  const input = document.createElement('input');
  input.type = 'date';
  input.className = 'native-date-input';
  if (initDate) input.value = initDate;
  input.addEventListener('change', checkSceneInput);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'item-remove-btn';
  removeBtn.style.cssText = 'position: static; padding: 4px 8px;';
  removeBtn.title = '消す';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => { div.remove(); checkSceneInput(); });

  div.append(input, removeBtn);
  container.appendChild(div);
}

export function collectDatesFromContainer(containerId) {
  const dates = [];
  document.getElementById(containerId)?.querySelectorAll('.native-date-input').forEach((input) => {
    if (input.value) dates.push(input.value);
  });
  return dates;
}

function createItemInputBlock(type, item = null) {
  const id = item ? item.id : Date.now() + Math.random().toString(36).substring(2, 7);
  const status = safeStatus(item ? item.status : '未着手');
  const isCostume = type === 'costume';
  const labelName = isCostume ? '衣装セット名' : '小道具名';
  const labelDesc = isCostume ? '衣装詳細' : '小道具詳細';
  const labelWho = isCostume ? '誰の衣装' : '誰の小道具';
  const placeholderName = isCostume ? '例: 夏制服' : '例: スマホ';
  const placeholderDesc = isCostume ? '例: ○○さんの私物' : '例: なるべく小さいもの';
  const labelMuted = 'margin-bottom: 4px; font-weight: bold; font-size: 12px; color: var(--muted-text); margin-top: 8px;';

  const div = document.createElement('div');
  div.className = 'item-input-block';
  div.dataset.id = id;

  div.innerHTML = `
    <button type="button" class="item-remove-btn" title="この枠を消す">✕</button>
    <select class="item-status status-color">
      <option value="未着手">未着手</option>
      <option value="準備中">準備中</option>
      <option value="準備完了">準備完了</option>
    </select>

    <div style="${labelMuted}">${labelName}</div>
    <input type="text" class="item-name" placeholder="${placeholderName}">
    <div class="suggestion-container"></div>

    <div style="${labelMuted}">${labelWho}</div>
    <select class="item-character"></select>

    <div style="${labelMuted}">構成パーツ（名称・詳細・準備状況）</div>
    <div class="cos-parts"></div>
    <button type="button" class="cos-add-part" style="width:auto; margin:4px 0 0 0; padding:4px 10px; font-size:12px; background:transparent; color:var(--text-color); border:1px dashed var(--border-color);">＋ パーツを追加</button>

    <div style="${labelMuted}">${labelDesc}</div>
    <textarea class="item-desc" placeholder="${placeholderDesc}"></textarea>

    <div style="${labelMuted}">金額/メモ</div>
    <input type="text" class="item-price" placeholder="例: 1500円">
  `;

  const statusSel = div.querySelector('.item-status');
  statusSel.value = status;
  updateSelectColor(statusSel);
  statusSel.addEventListener('change', () => updateSelectColor(statusSel));

  const nameInput = div.querySelector('.item-name');
  nameInput.value = item ? (item.name || '') : '';
  nameInput.addEventListener('input', () => showSuggestions(nameInput, type));

  div.querySelector('.item-desc').value = item ? (item.desc || '') : '';
  div.querySelector('.item-price').value = item ? (item.price || '') : '';

  const charSel = div.querySelector('.item-character');
  charSel.add(new Option('未設定', ''));
  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  const cast = (movie && Array.isArray(movie.cast)) ? movie.cast : [];
  const seen = new Set();
  cast.forEach((c) => {
    if (c.character && !seen.has(c.character)) {
      seen.add(c.character);
      charSel.add(new Option(c.actor ? `${c.character}（${c.actor}）` : c.character, c.character));
    }
  });
  const curChar = item ? (item.character || '') : '';
  if (curChar && !seen.has(curChar)) charSel.add(new Option(curChar, curChar));
  charSel.value = curChar;

  const partsContainer = div.querySelector('.cos-parts');
  const addPart = (part = {}) => {
    const row = document.createElement('div');
    row.className = 'cos-part-row';
    row.style.cssText = 'display:flex; gap:6px; margin-bottom:6px; align-items:center; flex-wrap:wrap;';

    const sel = document.createElement('select');
    sel.className = 'cos-part-status status-color';
    sel.style.cssText = 'width:auto; margin:0; padding:4px 6px; font-size:12px;';
    ['未着手', '準備中', '準備完了'].forEach((o) => sel.add(new Option(o, o)));
    sel.value = safeStatus(part.status || '未着手');
    updateSelectColor(sel);
    sel.addEventListener('change', () => updateSelectColor(sel));

    const nm = document.createElement('input');
    nm.type = 'text';
    nm.className = 'cos-part';
    nm.placeholder = 'パーツ名 例: シャツ';
    nm.value = part.name || '';
    nm.style.cssText = 'margin:0; font-size:12px; padding:6px; flex:1; min-width:90px;';

    const ds = document.createElement('input');
    ds.type = 'text';
    ds.className = 'cos-part-desc';
    ds.placeholder = '詳細（任意）';
    ds.value = part.desc || '';
    ds.style.cssText = 'margin:0; font-size:12px; padding:6px; flex:1; min-width:90px;';

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'item-remove-btn';
    rm.style.cssText = 'position:static; padding:6px 10px;';
    rm.title = 'このパーツを消す';
    rm.textContent = '✕';
    rm.addEventListener('click', () => row.remove());

    row.append(sel, nm, ds, rm);
    partsContainer.appendChild(row);
  };
  (item && Array.isArray(item.parts) ? item.parts : []).forEach((p) => addPart(typeof p === 'string' ? { name: p } : (p || {})));
  div.querySelector('.cos-add-part').addEventListener('click', () => addPart({}));

  div.querySelector('.item-remove-btn').addEventListener('click', () => div.remove());

  return div;
}

export function addCostumeInput(containerId, item = null) {
  document.getElementById(containerId)?.appendChild(createItemInputBlock('costume', item));
}
export function addPropInput(containerId, item = null) {
  document.getElementById(containerId)?.appendChild(createItemInputBlock('prop', item));
}

export function showSuggestions(inputElem, type) {
  const name = inputElem.value.trim();
  const block = inputElem.closest('.item-input-block');
  const suggestionContainer = block.querySelector('.suggestion-container');
  suggestionContainer.innerHTML = '';

  if (!name || !state.currentMovieId) return;
  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  if (!movie) return;

  const candidates = [];
  const seen = new Set();

  movie.scenes.forEach((s) => {
    const items = (type === 'costume' ? s.costumes : s.props) || [];
    items.forEach((i) => {
      if (i.name.includes(name) && (i.desc || i.price || i.status)) {
        const key = i.name + '|' + i.desc + '|' + i.price + '|' + i.status;
        if (!seen.has(key)) {
          seen.add(key);
          candidates.push(i);
        }
      }
    });
  });

  candidates.slice(0, 5).forEach((c) => {
    const chip = document.createElement('div');
    chip.className = 'suggestion-chip';
    chip.textContent = `${c.name} ${c.desc ? `(${c.desc.substring(0, 8)}...)` : ''}`;
    chip.addEventListener('click', () => {
      inputElem.value = c.name;
      const descInput = block.querySelector('.item-desc');
      const priceInput = block.querySelector('.item-price');
      const statusInput = block.querySelector('.item-status');
      if (descInput) descInput.value = c.desc;
      if (priceInput) priceInput.value = c.price;
      if (statusInput && c.status) {
        statusInput.value = safeStatus(c.status);
        updateSelectColor(statusInput);
      }
      suggestionContainer.innerHTML = '';
    });
    suggestionContainer.appendChild(chip);
  });
}

export function collectItemsFromDOM(containerId) {
  const items = [];
  document.querySelectorAll(`#${containerId} .item-input-block`).forEach((block) => {
    const name = block.querySelector('.item-name').value.trim();
    if (name) {
      const obj = {
        id: block.dataset.id,
        status: safeStatus(block.querySelector('.item-status').value),
        name: name,
        desc: block.querySelector('.item-desc').value,
        price: block.querySelector('.item-price').value
      };
      const charSel = block.querySelector('.item-character');
      if (charSel) {
        obj.character = charSel.value;
        obj.parts = [...block.querySelectorAll('.cos-part-row')].map((row) => ({
          name: row.querySelector('.cos-part').value.trim(),
          desc: row.querySelector('.cos-part-desc').value.trim(),
          status: safeStatus(row.querySelector('.cos-part-status').value)
        })).filter((p) => p.name);
      }
      items.push(obj);
    }
  });
  return items;
}

export function addCastInput(containerId, cast = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'cast-input-row';

  const charInput = document.createElement('input');
  charInput.type = 'text';
  charInput.className = 'cast-char';
  charInput.placeholder = '登場人物（例: 羽芝）';
  charInput.value = cast ? (cast.character || '') : '';

  const actorInput = document.createElement('input');
  actorInput.type = 'text';
  actorInput.className = 'cast-actor';
  actorInput.placeholder = '役者（任意）';
  actorInput.value = cast ? (cast.actor || '') : '';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'item-remove-btn';
  removeBtn.style.cssText = 'position: static; padding: 8px 10px;';
  removeBtn.title = 'この行を消す';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => div.remove());

  div.append(charInput, actorInput, removeBtn);
  container.appendChild(div);
}

export function renderCharacterCheckboxes(containerId, selectedNames = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const movie = state.movies.find((m) => m.id === state.currentMovieId);
  const cast = (movie && Array.isArray(movie.cast)) ? movie.cast : [];

  const names = [];
  const seen = new Set();
  cast.forEach((c) => {
    if (c.character && !seen.has(c.character)) {
      seen.add(c.character);
      names.push({ character: c.character, actor: c.actor || '' });
    }
  });
  selectedNames.forEach((n) => {
    if (n && !seen.has(n)) { seen.add(n); names.push({ character: n, actor: '' }); }
  });

  if (names.length === 0) {
    container.innerHTML = '<p class="scene-info" style="margin:0;">登場人物が未登録です。映画一覧の「編集」→基本情報で登録してください。</p>';
    return;
  }

  const selectedSet = new Set(selectedNames);
  names.forEach(({ character, actor }) => {
    const label = document.createElement('label');
    label.className = 'character-check';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'character-checkbox';
    cb.value = character;
    cb.checked = selectedSet.has(character);

    const span = document.createElement('span');
    span.textContent = actor ? `${character}（${actor}）` : character;

    label.append(cb, span);
    container.appendChild(label);
  });
}

export function collectCharactersFromDOM(containerId) {
  const names = [];
  document.querySelectorAll(`#${containerId} .character-checkbox:checked`).forEach((cb) => {
    if (cb.value) names.push(cb.value);
  });
  return names;
}

export function addDirectorInput(containerId, name = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'cast-input-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'director-name';
  input.placeholder = '監督名';
  input.value = name || '';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'item-remove-btn';
  removeBtn.style.cssText = 'position: static; padding: 8px 10px;';
  removeBtn.title = 'この行を消す';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => div.remove());

  div.append(input, removeBtn);
  container.appendChild(div);
}

export function collectDirectorsFromDOM(containerId) {
  const directors = [];
  document.querySelectorAll(`#${containerId} .director-name`).forEach((input) => {
    const name = input.value.trim();
    if (name) directors.push(name);
  });
  return directors;
}

export function collectCastFromDOM(containerId) {
  const cast = [];
  document.querySelectorAll(`#${containerId} .cast-input-row`).forEach((row) => {
    const character = row.querySelector('.cast-char').value.trim();
    const actor = row.querySelector('.cast-actor').value.trim();
    if (character) cast.push({ character, actor });
  });
  return cast;
}
