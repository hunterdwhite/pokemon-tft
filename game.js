/**
 * Composition root: wires data, state, battle, and ui; defines game actions and bootstraps on load.
 */
import * as data from './js/data.js';
import * as state from './js/state.js';
import * as battle from './js/battle.js';
import * as ui from './js/ui.js';

const {
  LINES,
  SHOP_SIZE,
  XP_PER_ROUND,
  BASE_INCOME,
  INTEREST_RATE,
  MAX_INTEREST,
  XP_TO_NEXT,
  MAX_LEVEL,
  XP_BUY_COST,
  XP_BUY_AMOUNT,
  REROLL_COST,
  createPokemon,
  spriteUrl
} = data;

function render() {
  ui.render();
}

function addXp(amount) {
  const G = state.getState();
  if (G.level >= MAX_LEVEL) return;
  G.xp += amount;
  while (G.level < MAX_LEVEL && G.xp >= XP_TO_NEXT[G.level]) {
    G.xp -= XP_TO_NEXT[G.level];
    G.level++;
  }
  if (G.level >= MAX_LEVEL) G.xp = 0;
}

function buyXp() {
  const G = state.getState();
  if (G.phase !== 'prep') return;
  if (G.gold < XP_BUY_COST) return;
  if (G.level >= MAX_LEVEL) return;
  G.gold -= XP_BUY_COST;
  addXp(XP_BUY_AMOUNT);
  render();
}

function rollShop() {
  const G = state.getState();
  G.shop = [];
  G.shopSold = [];
  const pool = [];
  LINES.forEach((line, i) => {
    const w = line.cost === 1 ? 4 : line.cost === 2 ? 3 : 2;
    for (let j = 0; j < w; j++) pool.push(i);
  });
  for (let i = 0; i < SHOP_SIZE; i++) {
    const lineIdx = pool[Math.floor(Math.random() * pool.length)];
    let star = 1;
    if (G.round >= 8 && Math.random() < 0.15) star = 2;
    if (G.round >= 15 && Math.random() < 0.08) star = 2;
    G.shop.push(createPokemon(lineIdx, star));
    G.shopSold.push(false);
  }
}

function buyPokemon(idx) {
  const G = state.getState();
  if (G.phase !== 'prep') return;
  if (G.shopSold[idx]) return;
  const pkmn = G.shop[idx];
  if (G.gold < pkmn.cost) return;
  const slot = state.firstEmptyBench();
  if (!slot) return;
  G.gold -= pkmn.cost;
  G.shopSold[idx] = true;
  state.setAt(slot, createPokemon(pkmn.lineIdx, pkmn.star));
  render();
}

function rerollShop() {
  const G = state.getState();
  if (G.phase !== 'prep') return;
  if (G.gold < REROLL_COST) return;
  G.gold -= REROLL_COST;
  rollShop();
  render();
}

let justDragged = false;

function handleCellClick(pos) {
  const G = state.getState();
  if (G.phase !== 'prep' || justDragged) return;
  const clicked = state.getAt(pos);
  const sel = G.selected;

  if (sel && state.samePos(sel, pos)) {
    G.selected = null;
    render();
    return;
  }

  if (sel) {
    const selPkmn = state.getAt(sel);
    if (!selPkmn) {
      G.selected = null;
      render();
      return;
    }

    if (clicked && selPkmn.lineIdx === clicked.lineIdx && selPkmn.star === clicked.star && selPkmn.star < 3) {
      state.clearAt(sel);
      const evolved = createPokemon(selPkmn.lineIdx, selPkmn.star + 1);
      state.setAt(pos, evolved);
      G.selected = null;
      render();
      triggerMergeFlash(pos);
      return;
    }

    if (!clicked) {
      if (pos.area === 'field' && !state.canPlaceOnField(sel)) {
        G.selected = pos.area === 'bench' ? null : { ...pos };
        render();
        return;
      }
      state.setAt(pos, selPkmn);
      state.clearAt(sel);
      G.selected = null;
      render();
      return;
    }

    state.setAt(sel, clicked);
    state.setAt(pos, selPkmn);
    G.selected = null;
    render();
    return;
  }

  if (clicked) {
    G.selected = pos;
  } else {
    G.selected = null;
  }
  render();
}

function sellAt(pos) {
  const pkmn = state.getAt(pos);
  if (!pkmn) return;
  const G = state.getState();
  G.gold += pkmn.cost * pkmn.star;
  state.clearAt(pos);
  G.selected = null;
  render();
}

function sellSelected() {
  const G = state.getState();
  if (!G.selected) return;
  sellAt(G.selected);
}

function setJustDragged() {
  justDragged = true;
  setTimeout(() => { justDragged = false; }, 50);
}

function triggerMergeFlash(pos) {
  const selector =
    pos.area === 'field'
      ? `#field .cell[data-r="${pos.r}"][data-c="${pos.c}"] img`
      : `#bench .cell[data-i="${pos.i}"] img`;
  const el = document.querySelector(selector);
  if (el) {
    el.classList.add('merge-flash');
    setTimeout(() => el.classList.remove('merge-flash'), 500);
  }
}

function startRound() {
  const G = state.getState();
  G.round++;

  const income = Math.min(BASE_INCOME + G.round, 10);
  const interest = Math.min(Math.floor(G.gold * INTEREST_RATE), MAX_INTEREST);
  G.gold += income + interest;

  addXp(XP_PER_ROUND);

  const freeCount = G.round <= 2 ? 3 : 2;
  let placed = 0;
  for (let i = 0; i < freeCount; i++) {
    const slot = state.firstEmptyBench();
    if (!slot) break;
    const lineIdx = Math.floor(Math.random() * LINES.length);
    let star = 1;
    if (G.round >= 10 && Math.random() < 0.1) star = 2;
    state.setAt(slot, createPokemon(lineIdx, star));
    placed++;
  }

  rollShop();
  G.phase = 'prep';
  G.selected = null;

  const infoEl = document.getElementById('round-info');
  infoEl.innerHTML = `+<span class="income">${income + interest}g</span> (${income} base + ${interest} int) · +${XP_PER_ROUND} XP · <span class="free">${placed}</span> free`;
  infoEl.classList.add('active');

  render();
}

function startBattle() {
  battle.startBattle({
    onRender: render,
    onRoundStart: startRound,
    onGameOver: ui.showGameOver
  });
}

const actions = {
  buyXp,
  buyPokemon,
  rerollShop,
  sellSelected,
  sellAt,
  handleCellClick,
  startBattle,
  initGameState: state.initGameState,
  startRound,
  triggerMergeFlash,
  setJustDragged,
  render
};

function preloadSprites() {
  LINES.forEach(line => line.ids.forEach(id => {
    new Image().src = spriteUrl(id);
  }));
}

window.addEventListener('load', () => {
  preloadSprites();
  state.initGameState();
  ui.initUI(actions);
  render();
  ui.showStartScreen();
});

export const Game = {
  _state: () => state.getState()
};
