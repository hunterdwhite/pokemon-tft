/** Game state and position/field helpers. */

import {
  FIELD_ROWS,
  FIELD_COLS,
  BENCH_SIZE,
  START_GOLD,
  START_HP,
  START_LEVEL
} from './data.js';

let G = {};

export function getState() {
  return G;
}

export function initGameState() {
  G = {
    round: 0,
    gold: START_GOLD,
    hp: START_HP,
    maxHp: START_HP,
    level: START_LEVEL,
    xp: 0,
    field: Array.from({ length: FIELD_ROWS }, () => Array(FIELD_COLS).fill(null)),
    bench: Array(BENCH_SIZE).fill(null),
    shop: [],
    shopSold: [],
    phase: 'start',
    selected: null,
    battleUnits: [],
    battleAnimId: null,
    battleOver: false,
    battleSpeed: 1,
    streak: 0
  };
}

export function getAt(pos) {
  if (pos.area === 'field') return G.field[pos.r][pos.c];
  return G.bench[pos.i];
}

export function setAt(pos, pkmn) {
  if (pos.area === 'field') G.field[pos.r][pos.c] = pkmn;
  else G.bench[pos.i] = pkmn;
}

export function clearAt(pos) {
  setAt(pos, null);
}

export function samePos(a, b) {
  if (!a || !b) return false;
  if (a.area !== b.area) return false;
  if (a.area === 'field') return a.r === b.r && a.c === b.c;
  return a.i === b.i;
}

export function fieldCount() {
  let n = 0;
  for (let r = 0; r < FIELD_ROWS; r++)
    for (let c = 0; c < FIELD_COLS; c++)
      if (G.field[r][c]) n++;
  return n;
}

export function fieldPokemon() {
  const out = [];
  for (let r = 0; r < FIELD_ROWS; r++)
    for (let c = 0; c < FIELD_COLS; c++)
      if (G.field[r][c]) out.push(G.field[r][c]);
  return out;
}

export function firstEmptyBench() {
  for (let i = 0; i < BENCH_SIZE; i++)
    if (!G.bench[i]) return { area: 'bench', i };
  return null;
}

export function firstEmptyField() {
  for (let r = 0; r < FIELD_ROWS; r++)
    for (let c = 0; c < FIELD_COLS; c++)
      if (!G.field[r][c]) return { area: 'field', r, c };
  return null;
}

export function canPlaceOnField(fromPos) {
  if (fromPos && fromPos.area === 'field') return true;
  return fieldCount() < G.level;
}

export function allPokemon() {
  const out = [];
  for (let r = 0; r < FIELD_ROWS; r++)
    for (let c = 0; c < FIELD_COLS; c++)
      if (G.field[r][c]) out.push(G.field[r][c]);
  for (let i = 0; i < BENCH_SIZE; i++)
    if (G.bench[i]) out.push(G.bench[i]);
  return out;
}
