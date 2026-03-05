/** DOM rendering, overlays, and drag/drop. Uses state + data and receives game actions via initUI(actions). */

import { getState, getAt, setAt, clearAt, samePos, fieldCount, fieldPokemon, firstEmptyBench, canPlaceOnField, hasMega } from './state.js';
import { spriteUrl, TYPE_COLORS, LINES, XP_TO_NEXT, MAX_LEVEL, XP_BUY_COST, XP_BUY_AMOUNT, REROLL_COST, createPokemon, getActiveTraits, getActiveRoleTraits, ROLE_COLORS, MEGA_FORMS, FIELD_ROWS, FIELD_COLS } from './data.js';

let actions = {};

export function initUI(a) {
  actions = a;
  setupDragDrop();
}

export function render() {
  const G = getState();
  renderHeader();
  renderTraits();
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
  const xpPct = G.level >= MAX_LEVEL ? 100 : (G.xp / XP_TO_NEXT[G.level]) * 100;
  if (window.anime) {
    window.anime({
      targets: xpBar,
      width: xpPct + '%',
      duration: 600,
      easing: 'easeOutQuad'
    });
  } else {
    xpBar.style.width = xpPct + '%';
  }

  const hpPct = (G.hp / G.maxHp) * 100;
  const hpBar = document.getElementById('hp-bar');
  if (window.anime) {
    window.anime({
      targets: hpBar,
      width: hpPct + '%',
      duration: 700,
      easing: 'easeOutQuad'
    });
  } else {
    hpBar.style.width = hpPct + '%';
  }
  document.getElementById('hp-text').textContent = G.hp + '/' + G.maxHp;
  document.getElementById('gold-display').textContent = G.gold + 'g';
}

function traitBonusDesc(bonus) {
  const parts = [];
  if (bonus.hp) parts.push('+' + Math.round((bonus.hp - 1) * 100) + '% HP');
  if (bonus.atk) parts.push('+' + Math.round((bonus.atk - 1) * 100) + '% ATK');
  if (bonus.spAtk) parts.push('+' + Math.round((bonus.spAtk - 1) * 100) + '% SpAtk');
  if (bonus.spd != null) parts.push('+' + Math.round((1 - bonus.spd) * 100) + '% speed');
  return parts.join(', ') || 'active';
}

function roleBonusDesc(bonus) {
  const parts = [];
  if (bonus.hp) parts.push('+' + Math.round((bonus.hp - 1) * 100) + '% HP');
  if (bonus.atk) parts.push('+' + Math.round((bonus.atk - 1) * 100) + '% ATK');
  if (bonus.spAtk) parts.push('+' + Math.round((bonus.spAtk - 1) * 100) + '% SpAtk');
  if (bonus.spd != null) parts.push('+' + Math.round((1 - bonus.spd) * 100) + '% speed');
  return parts.join(', ') || 'active';
}

function renderTraits() {
  const G = getState();
  const row = document.getElementById('traits-row');
  if (!row) return;
  const team = fieldPokemon();
  const typeTraits = getActiveTraits(team);
  const roleTraits = getActiveRoleTraits(team);
  row.innerHTML = '';
  if (typeTraits.length === 0 && roleTraits.length === 0) {
    row.classList.add('traits-empty');
    return;
  }
  row.classList.remove('traits-empty');
  typeTraits.forEach(({ type, count, bonus }) => {
    const badge = document.createElement('span');
    badge.className = 'trait-badge trait-type';
    badge.style.backgroundColor = TYPE_COLORS[type] || '#666';
    badge.title = traitBonusDesc(bonus);
    badge.innerHTML = `<span class="trait-name">${type}</span> <span class="trait-count">(${count})</span> <span class="trait-desc">${traitBonusDesc(bonus)}</span>`;
    row.appendChild(badge);
  });
  roleTraits.forEach(({ role, count, bonus }) => {
    const badge = document.createElement('span');
    badge.className = 'trait-badge trait-role';
    badge.style.backgroundColor = ROLE_COLORS[role] || '#666';
    badge.title = roleBonusDesc(bonus);
    badge.innerHTML = `<span class="trait-name">${role}</span> <span class="trait-count">(2)</span> <span class="trait-desc">${roleBonusDesc(bonus)}</span>`;
    row.appendChild(badge);
  });
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
      const wouldBeMega = pkmn.star === 3 && G.chosenMegaLineIdx === pkmn.lineIdx;
      const canMergeToHere = selPkmn && pkmn.lineIdx === selPkmn.lineIdx && pkmn.star === selPkmn.star &&
        (pkmn.star < 3 || (wouldBeMega && !hasMega()));
      if (canMergeToHere) cell.classList.add('merge-target');
    }

    const stars = document.createElement('div');
    stars.className = 'stars';
    stars.textContent = '★'.repeat(pkmn.star);
    if (pkmn.star >= 4) stars.style.color = '#c070ff';
    else if (pkmn.star >= 3) stars.style.color = '#ff4444';
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

    if (pkmn.role) {
      const roleBadge = document.createElement('div');
      roleBadge.className = 'role-badge';
      roleBadge.textContent = pkmn.role;
      roleBadge.style.background = ROLE_COLORS[pkmn.role] || '#666';
      roleBadge.title = 'Role: ' + pkmn.role;
      cell.appendChild(roleBadge);
    }
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

    if (pkmn.role) {
      const roleEl = document.createElement('div');
      roleEl.className = 'card-role';
      roleEl.textContent = pkmn.role;
      roleEl.style.background = ROLE_COLORS[pkmn.role] || '#666';
      roleEl.title = 'Role: ' + pkmn.role;
      card.appendChild(roleEl);
    }

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
    actions.initGameState();
    showMegaPickScreen();
  });
}

export function hideOverlay() {
  const el = document.getElementById('overlay');
  if (el) el.style.display = 'none';
}

export function showMegaPickScreen() {
  const el = document.getElementById('overlay');
  el.style.display = 'flex';
  let selectedLineIdx = null;
  const optionsHtml = MEGA_FORMS.map(m => `
    <button class="mega-pick-card" data-line-idx="${m.lineIdx}" type="button">
      <img src="${spriteUrl(m.spriteId)}" alt="${m.name}" />
      <span class="mega-pick-name">${m.name}</span>
    </button>
  `).join('');
  el.innerHTML = `
    <h1>Choose your Mega Evolution</h1>
    <p style="color:var(--text-dim);margin-bottom:12px;font-size:13px">Pick the one evolution line that can reach 4★ (Mega) this run. Only this line can merge two 3★ into a Mega.</p>
    <div class="mega-pick-grid" id="mega-pick-grid">${optionsHtml}</div>
    <button class="btn-start" id="mega-confirm-btn" disabled>Confirm</button>
  `;
  const grid = document.getElementById('mega-pick-grid');
  const confirmBtn = document.getElementById('mega-confirm-btn');
  grid.querySelectorAll('.mega-pick-card').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedLineIdx = parseInt(btn.dataset.lineIdx, 10);
      grid.querySelectorAll('.mega-pick-card').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      confirmBtn.disabled = false;
    });
  });
  confirmBtn.addEventListener('click', () => {
    if (selectedLineIdx == null) return;
    actions.onMegaChosen(selectedLineIdx);
    hideOverlay();
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
    showStartScreen();
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
        const G = getState();
        const wouldBeMega = hPkmn.star === 3 && G.chosenMegaLineIdx === hPkmn.lineIdx;
        const canMerge = hPkmn && hPkmn.lineIdx === dragState.pkmn.lineIdx && hPkmn.star === dragState.pkmn.star &&
          (hPkmn.star < 3 || (wouldBeMega && !hasMega()));
        if (canMerge) hoverCell.classList.add('merge-target');
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

        const wouldBeMega = srcPkmn.star === 3 && getState().chosenMegaLineIdx === srcPkmn.lineIdx;
        const canMergeUp = dropPkmn && srcPkmn.lineIdx === dropPkmn.lineIdx && srcPkmn.star === dropPkmn.star &&
          (srcPkmn.star < 3 || (wouldBeMega && !hasMega()));
        if (canMergeUp) {
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
