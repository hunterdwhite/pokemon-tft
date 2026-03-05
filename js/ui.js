/** DOM rendering, overlays, and drag/drop. Uses state + data and receives game actions via initUI(actions). */

import { getState, getAt, setAt, clearAt, samePos, fieldCount, fieldPokemon, firstEmptyBench, canPlaceOnField } from './state.js';
import { spriteUrl, TYPE_COLORS, LINES, XP_TO_NEXT, MAX_LEVEL, XP_BUY_COST, XP_BUY_AMOUNT, REROLL_COST, createPokemon } from './data.js';

let actions = {};

export function initUI(a) {
  actions = a;
  setupDragDrop();
}

export function render() {
  const G = getState();
  renderHeader();
  renderField();
  renderBench();
  renderSellZone();
  renderShop();
  renderControls();
  renderPhaseBanner();
}

function renderHeader() {
  const G = getState();
  document.getElementById('round-num').textContent = G.round;
  document.getElementById('level-num').textContent = G.level;

  const xpBar = document.getElementById('xp-bar');
  if (G.level >= MAX_LEVEL) {
    xpBar.style.width = '100%';
  } else {
    xpBar.style.width = (G.xp / XP_TO_NEXT[G.level]) * 100 + '%';
  }

  const hpPct = (G.hp / G.maxHp) * 100;
  document.getElementById('hp-bar').style.width = hpPct + '%';
  document.getElementById('hp-text').textContent = G.hp + '/' + G.maxHp;
  document.getElementById('gold-display').textContent = G.gold + 'g';
}

function renderPhaseBanner() {
  const G = getState();
  const el = document.getElementById('phase-banner');
  if (G.phase === 'prep') {
    el.textContent = 'PREP — Buy, merge & arrange your team';
    el.className = 'phase-banner';
  } else if (G.phase === 'battle') {
    el.textContent = 'BATTLE!';
    el.className = 'phase-banner battle';
  } else {
    el.textContent = '';
  }
}

function renderField() {
  const G = getState();
  const grid = document.getElementById('field');
  grid.innerHTML = '';

  const fc = fieldCount();
  const countEl = document.getElementById('field-count');
  countEl.textContent = `(${fc}/${G.level})`;
  countEl.classList.toggle('full', fc >= G.level);

  const FIELD_ROWS = 2;
  const FIELD_COLS = 4;
  for (let r = 0; r < FIELD_ROWS; r++) {
    for (let c = 0; c < FIELD_COLS; c++) {
      const pos = { area: 'field', r, c };
      const cell = makeCellEl(pos, G.field[r][c]);
      grid.appendChild(cell);
    }
  }
}

function renderBench() {
  const G = getState();
  const grid = document.getElementById('bench');
  grid.innerHTML = '';

  const benchHint = document.getElementById('bench-hint');
  const emptyCount = G.bench.filter(b => !b).length;
  benchHint.textContent = emptyCount === 0 ? 'Full!' : '';

  const BENCH_SIZE = 8;
  for (let i = 0; i < BENCH_SIZE; i++) {
    const pos = { area: 'bench', i };
    const cell = makeCellEl(pos, G.bench[i]);
    grid.appendChild(cell);
  }
}

function makeCellEl(pos, pkmn) {
  const G = getState();
  const cell = document.createElement('div');
  cell.className = 'cell';

  if (pos.area === 'field') {
    cell.dataset.r = pos.r;
    cell.dataset.c = pos.c;
    cell.dataset.area = 'field';
  } else {
    cell.dataset.i = pos.i;
    cell.dataset.area = 'bench';
  }

  if (pkmn) {
    const isSel = G.selected && samePos(G.selected, pos);
    if (isSel) cell.classList.add('selected');

    if (G.selected && !isSel) {
      const selPkmn = getAt(G.selected);
      if (selPkmn && pkmn.lineIdx === selPkmn.lineIdx && pkmn.star === selPkmn.star && pkmn.star < 3) {
        cell.classList.add('merge-target');
      }
    }

    const stars = document.createElement('div');
    stars.className = 'stars';
    stars.textContent = '★'.repeat(pkmn.star);
    if (pkmn.star >= 3) stars.style.color = '#ff4444';
    cell.appendChild(stars);

    const img = document.createElement('img');
    img.src = spriteUrl(pkmn.spriteId);
    img.alt = pkmn.name;
    img.draggable = false;
    cell.appendChild(img);

    const nameEl = document.createElement('div');
    nameEl.className = 'pkmn-name';
    nameEl.textContent = pkmn.name;
    cell.appendChild(nameEl);

    const badge = document.createElement('div');
    badge.className = 'type-badge';
    badge.textContent = pkmn.type;
    badge.style.background = TYPE_COLORS[pkmn.type] || '#666';
    cell.appendChild(badge);
  } else {
    cell.classList.add('empty');
  }

  cell.addEventListener('click', () => actions.handleCellClick(pos));
  return cell;
}

function renderSellZone() {
  const G = getState();
  const el = document.getElementById('sell-zone');
  if (G.phase !== 'prep') {
    el.classList.remove('visible');
    return;
  }

  if (G.selected && getAt(G.selected)) {
    const pkmn = getAt(G.selected);
    el.textContent = `SELL ${pkmn.name} (+${pkmn.cost * pkmn.star}g)`;
    el.classList.add('visible');
  } else {
    el.classList.remove('visible');
  }
}

function renderShop() {
  const G = getState();
  const shopEl = document.getElementById('shop');
  const hintEl = document.getElementById('shop-hint');
  shopEl.innerHTML = '';

  if (G.phase !== 'prep') {
    document.getElementById('shop-wrap').style.display = 'none';
    return;
  }
  document.getElementById('shop-wrap').style.display = '';
  const benchFull = !firstEmptyBench();
  hintEl.textContent = benchFull ? 'Bench full!' : '';

  G.shop.forEach((pkmn, i) => {
    const card = document.createElement('div');
    card.className = 'shop-card';
    if (G.shopSold[i]) card.classList.add('sold');
    else if (G.gold < pkmn.cost || benchFull) card.classList.add('cant-afford');

    const img = document.createElement('img');
    img.src = spriteUrl(pkmn.spriteId);
    img.draggable = false;
    card.appendChild(img);

    const nameEl = document.createElement('div');
    nameEl.className = 'card-name';
    nameEl.textContent = pkmn.name;
    card.appendChild(nameEl);

    const costEl = document.createElement('div');
    costEl.className = 'card-cost';
    costEl.textContent = pkmn.cost + 'g';
    card.appendChild(costEl);

    card.addEventListener('click', () => actions.buyPokemon(i));
    shopEl.appendChild(card);
  });
}

function renderControls() {
  const G = getState();
  const el = document.getElementById('controls');
  el.innerHTML = '';

  if (G.phase === 'prep') {
    const xpBtn = document.createElement('button');
    xpBtn.className = 'btn btn-xp';
    if (G.level >= MAX_LEVEL) {
      xpBtn.innerHTML = 'MAX<span class="sub">Lv ' + G.level + '</span>';
      xpBtn.disabled = true;
    } else {
      xpBtn.innerHTML = 'Buy XP<span class="sub">' + XP_BUY_COST + 'g → ' + XP_BUY_AMOUNT + ' XP</span>';
      xpBtn.disabled = G.gold < XP_BUY_COST;
    }
    xpBtn.addEventListener('click', () => actions.buyXp());
    el.appendChild(xpBtn);

    const reroll = document.createElement('button');
    reroll.className = 'btn';
    reroll.innerHTML = 'Reroll<span class="sub">' + REROLL_COST + 'g</span>';
    reroll.addEventListener('click', () => actions.rerollShop());
    el.appendChild(reroll);

    if (G.selected && getAt(G.selected)) {
      const sell = document.createElement('button');
      sell.className = 'btn btn-sell';
      const p = getAt(G.selected);
      sell.textContent = 'Sell +' + p.cost * p.star + 'g';
      sell.addEventListener('click', () => actions.sellSelected());
      el.appendChild(sell);
    }

    const battle = document.createElement('button');
    battle.className = 'btn btn-battle';
    battle.textContent = 'BATTLE!';
    battle.disabled = fieldPokemon().length === 0;
    battle.addEventListener('click', () => actions.startBattle());
    el.appendChild(battle);
  } else if (G.phase === 'battle') {
    const speedBtn = document.createElement('button');
    speedBtn.className = 'btn';
    speedBtn.textContent = 'Speed: ' + G.battleSpeed + 'x';
    speedBtn.addEventListener('click', () => {
      G.battleSpeed = G.battleSpeed >= 3 ? 1 : G.battleSpeed + 1;
      speedBtn.textContent = 'Speed: ' + G.battleSpeed + 'x';
    });
    el.appendChild(speedBtn);
  }
}

export function showStartScreen() {
  const el = document.getElementById('overlay');
  el.style.display = 'flex';
  el.innerHTML = `
    <h1>Pokémon Merge Tactics</h1>
    <p style="color:var(--text-dim);margin-bottom:16px">Merge · Evolve · Battle!</p>
    <div style="display:flex;gap:8px;margin-bottom:16px;opacity:0.6">
      <img src="${spriteUrl(6)}" style="width:44px;height:44px;image-rendering:pixelated" alt="">
      <img src="${spriteUrl(9)}" style="width:44px;height:44px;image-rendering:pixelated" alt="">
      <img src="${spriteUrl(3)}" style="width:44px;height:44px;image-rendering:pixelated" alt="">
      <img src="${spriteUrl(26)}" style="width:44px;height:44px;image-rendering:pixelated" alt="">
    </div>
    <p style="font-size:11px;max-width:320px;text-align:center;margin-bottom:20px;color:var(--text-dim)">
      Buy Pokémon → they go to your <b>bench</b>.<br>
      Move them to the <b>field</b> to fight.<br>
      Merge two identical ones to <b>evolve</b>!<br>
      Level up to field more Pokémon.
    </p>
    <button class="btn-start" id="start-btn">START GAME</button>
  `;
  document.getElementById('start-btn').addEventListener('click', () => {
    el.style.display = 'none';
    actions.initGameState();
    actions.startRound();
  });
}

export function showGameOver() {
  const G = getState();
  G.phase = 'gameover';
  const el = document.getElementById('overlay');
  el.style.display = 'flex';
  const team = fieldPokemon();
  el.innerHTML = `
    <h2 style="color:var(--hp-red)">GAME OVER</h2>
    <p>Reached Round ${G.round} · Level ${G.level}</p>
    <p style="color:var(--text);margin-bottom:20px">Team: ${team.map(p => p.name).join(', ') || 'none'}</p>
    <button class="btn-start" id="restart-btn">PLAY AGAIN</button>
  `;
  document.getElementById('restart-btn').addEventListener('click', () => {
    el.style.display = 'none';
    actions.initGameState();
    actions.startRound();
  });
}

// ---------- Drag & drop ----------
let dragState = null;
let justDragged = false;

function posFromCellEl(cellEl) {
  if (!cellEl) return null;
  if (cellEl.dataset.area === 'field')
    return { area: 'field', r: +cellEl.dataset.r, c: +cellEl.dataset.c };
  if (cellEl.dataset.area === 'bench') return { area: 'bench', i: +cellEl.dataset.i };
  return null;
}

function setupDragDrop() {
  document.addEventListener('pointerdown', (e) => {
    const G = getState();
    if (G.phase !== 'prep') return;
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const pos = posFromCellEl(cell);
    if (!pos) return;
    const pkmn = getAt(pos);
    if (!pkmn) return;

    dragState = { pos, pkmn, startX: e.clientX, startY: e.clientY, dragging: false, ghost: null };
  });

  document.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (!dragState.dragging && Math.abs(dx) + Math.abs(dy) < 8) return;

    if (!dragState.dragging) {
      dragState.dragging = true;
      const ghost = document.createElement('div');
      ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:999;opacity:0.8;';
      const img = document.createElement('img');
      img.src = spriteUrl(dragState.pkmn.spriteId);
      img.style.cssText = 'width:48px;height:48px;image-rendering:pixelated;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.5));';
      ghost.appendChild(img);
      document.body.appendChild(ghost);
      dragState.ghost = ghost;
    }

    dragState.ghost.style.left = e.clientX - 24 + 'px';
    dragState.ghost.style.top = e.clientY - 24 + 'px';

    document.querySelectorAll('.cell.merge-target, .cell.selected').forEach(c => c.classList.remove('merge-target', 'selected'));

    const hoverEl = document.elementFromPoint(e.clientX, e.clientY);
    const hoverCell = hoverEl?.closest('.cell');
    if (hoverCell) {
      const hPos = posFromCellEl(hoverCell);
      if (hPos && !samePos(hPos, dragState.pos)) {
        const hPkmn = getAt(hPos);
        if (hPkmn && hPkmn.lineIdx === dragState.pkmn.lineIdx && hPkmn.star === dragState.pkmn.star && hPkmn.star < 3) {
          hoverCell.classList.add('merge-target');
        }
      }
    }

    const sellZone = document.getElementById('sell-zone');
    const overSell = hoverEl?.closest('.sell-zone');
    sellZone.classList.toggle('drag-hover', !!overSell);
    if (dragState.dragging && !sellZone.classList.contains('visible')) {
      sellZone.textContent = `SELL ${dragState.pkmn.name} (+${dragState.pkmn.cost * dragState.pkmn.star}g)`;
      sellZone.classList.add('visible');
    }
  });

  document.addEventListener('pointerup', (e) => {
    if (!dragState) return;
    const ds = dragState;
    dragState = null;

    document.getElementById('sell-zone').classList.remove('drag-hover');

    if (ds.ghost) ds.ghost.remove();
    if (!ds.dragging) return;
    justDragged = true;
    setTimeout(() => (justDragged = false), 50);

    const dropEl = document.elementFromPoint(e.clientX, e.clientY);

    if (dropEl?.closest('.sell-zone')) {
      actions.sellAt(ds.pos);
      return;
    }

    const dropCell = dropEl?.closest('.cell');
    if (dropCell) {
      const dropPos = posFromCellEl(dropCell);
      if (dropPos && !samePos(dropPos, ds.pos)) {
        const srcPkmn = getAt(ds.pos);
        const dropPkmn = getAt(dropPos);
        if (!srcPkmn) {
          actions.render();
          return;
        }

        if (dropPkmn && srcPkmn.lineIdx === dropPkmn.lineIdx && srcPkmn.star === dropPkmn.star && srcPkmn.star < 3) {
          clearAt(ds.pos);
          setAt(dropPos, createPokemon(srcPkmn.lineIdx, srcPkmn.star + 1));
          getState().selected = null;
          actions.render();
          actions.triggerMergeFlash(dropPos);
          actions.setJustDragged?.();
          return;
        }

        if (!dropPkmn) {
          if (dropPos.area === 'field' && !canPlaceOnField(ds.pos)) {
            actions.render();
            return;
          }
          setAt(dropPos, srcPkmn);
          clearAt(ds.pos);
        } else {
          setAt(ds.pos, dropPkmn);
          setAt(dropPos, srcPkmn);
        }
        getState().selected = null;
        actions.setJustDragged?.();
      }
    }
    actions.render();
  });

  document.getElementById('sell-zone').addEventListener('click', () => {
    if (getState().selected) actions.sellSelected();
  });

  document.getElementById('level-badge').addEventListener('click', () => actions.buyXp());
}
