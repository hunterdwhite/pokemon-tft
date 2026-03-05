/** Game constants and pure data helpers (Pokémon lines, types, XP, sprite URL). */

export const FIELD_ROWS = 2;
export const FIELD_COLS = 4;
export const BENCH_SIZE = 8;
export const SHOP_SIZE = 5;
export const START_GOLD = 10;
export const START_HP = 100;
export const START_LEVEL = 3;
export const MAX_LEVEL = 8;
export const REROLL_COST = 1;
export const XP_BUY_COST = 4;
export const XP_BUY_AMOUNT = 4;
export const XP_PER_ROUND = 2;
export const BASE_INCOME = 3;
export const INTEREST_RATE = 0.1;
export const MAX_INTEREST = 5;
export const WIN_BONUS = 2;
export const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';

export const XP_TO_NEXT = [0, 0, 0, 2, 6, 10, 20, 36, 999];

export const TYPE_COLORS = {
  fire: '#f08030', water: '#6890f0', grass: '#78c850', electric: '#f8d030',
  ghost: '#705898', fighting: '#c03028', psychic: '#f85888', rock: '#b8a038'
};

export const TYPE_CHART = {
  fire: { grass: 1.5, water: 0.75, rock: 0.75 },
  water: { fire: 1.5, grass: 0.75, electric: 0.75 },
  grass: { water: 1.5, fire: 0.75 },
  electric: { water: 1.5, grass: 0.75 },
  ghost: { psychic: 1.5, fighting: 0 },
  fighting: { rock: 1.5, ghost: 0, psychic: 0.75 },
  psychic: { fighting: 1.5, ghost: 0.75 },
  rock: { fire: 1.5, fighting: 0.75 }
};

export const LINES = [
  { forms: ['Bulbasaur', 'Ivysaur', 'Venusaur'], ids: [1, 2, 3], type: 'grass', cost: 1, hp: 50, atk: 12, spd: 1.0 },
  { forms: ['Charmander', 'Charmeleon', 'Charizard'], ids: [4, 5, 6], type: 'fire', cost: 1, hp: 42, atk: 14, spd: 0.9 },
  { forms: ['Squirtle', 'Wartortle', 'Blastoise'], ids: [7, 8, 9], type: 'water', cost: 1, hp: 52, atk: 11, spd: 1.0 },
  { forms: ['Pichu', 'Pikachu', 'Raichu'], ids: [172, 25, 26], type: 'electric', cost: 2, hp: 36, atk: 16, spd: 0.7 },
  { forms: ['Gastly', 'Haunter', 'Gengar'], ids: [92, 93, 94], type: 'ghost', cost: 2, hp: 32, atk: 18, spd: 0.8 },
  { forms: ['Machop', 'Machoke', 'Machamp'], ids: [66, 67, 68], type: 'fighting', cost: 2, hp: 60, atk: 14, spd: 1.1 },
  { forms: ['Abra', 'Kadabra', 'Alakazam'], ids: [63, 64, 65], type: 'psychic', cost: 3, hp: 28, atk: 22, spd: 0.65 },
  { forms: ['Geodude', 'Graveler', 'Golem'], ids: [74, 75, 76], type: 'rock', cost: 1, hp: 65, atk: 10, spd: 1.2 },
];

export const STAR_MULT = { 1: 1, 2: 1.9, 3: 3.5 };

let uidCounter = 0;
export function makeUid() {
  return 'p' + (++uidCounter);
}

export function spriteUrl(id) {
  return SPRITE_BASE + id + '.png';
}

function getForm(lineIdx, star) {
  const line = LINES[lineIdx];
  return { name: line.forms[star - 1], spriteId: line.ids[star - 1], type: line.type, cost: line.cost };
}

function calcStats(lineIdx, star) {
  const line = LINES[lineIdx];
  const m = STAR_MULT[star];
  return { hp: Math.round(line.hp * m), atk: Math.round(line.atk * m), spd: line.spd / (1 + (star - 1) * 0.15) };
}

export function typeMult(atkType, defType) {
  return (TYPE_CHART[atkType] && TYPE_CHART[atkType][defType]) || 1.0;
}

export function createPokemon(lineIdx, star) {
  star = star || 1;
  const form = getForm(lineIdx, star);
  const stats = calcStats(lineIdx, star);
  return {
    uid: makeUid(),
    lineIdx,
    star,
    name: form.name,
    spriteId: form.spriteId,
    type: form.type,
    cost: form.cost,
    hp: stats.hp,
    atk: stats.atk,
    spd: stats.spd
  };
}
