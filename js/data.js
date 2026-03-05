/** Game constants and pure data helpers (Pokémon lines, types, XP, sprite URL). */

export const FIELD_ROWS = 4;
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

/** TFT-style type traits: (count) => stat multipliers. Bonuses apply to entire team when field has that many of the type. */
export const TRAITS = {
  fire: [
    { count: 2, atk: 1.1, spAtk: 1.1 },
    { count: 4, atk: 1.25, spAtk: 1.25 },
    { count: 6, atk: 1.45, spAtk: 1.45 }
  ],
  water: [
    { count: 2, hp: 1.1 },
    { count: 4, hp: 1.25 },
    { count: 6, hp: 1.45 }
  ],
  grass: [
    { count: 2, hp: 1.08, atk: 1.05 },
    { count: 4, hp: 1.2, atk: 1.12 },
    { count: 6, hp: 1.35, atk: 1.25 }
  ],
  electric: [
    { count: 2, spd: 0.92 },
    { count: 4, spd: 0.82 },
    { count: 6, spd: 0.68 }
  ],
  ghost: [
    { count: 2, hp: 1.12 },
    { count: 4, hp: 1.28 },
    { count: 6, hp: 1.5 }
  ],
  fighting: [
    { count: 2, atk: 1.12 },
    { count: 4, atk: 1.28 },
    { count: 6, atk: 1.5 }
  ],
  psychic: [
    { count: 2, spAtk: 1.1 },
    { count: 4, spAtk: 1.25 },
    { count: 6, spAtk: 1.45 }
  ],
  rock: [
    { count: 2, hp: 1.15 },
    { count: 4, hp: 1.35 },
    { count: 6, hp: 1.6 }
  ]
};

/** Role traits (Wall, Threat, Speed, Utility, Hazard). Set bonus limited to 2. */
export const ROLE_TRAITS = {
  Wall: [{ count: 2, hp: 1.2 }],
  Threat: [{ count: 2, atk: 1.15, spAtk: 1.15 }],
  Speed: [{ count: 2, spd: 0.85 }],
  Utility: [{ count: 2, hp: 1.08, spAtk: 1.1 }],
  Hazard: [{ count: 2, spAtk: 1.18 }]
};

export const ROLE_COLORS = {
  Wall: '#6b8e6b',
  Threat: '#c03028',
  Speed: '#f8d030',
  Utility: '#6890f0',
  Hazard: '#a040a0'
};

/** Count of each type on the field (team array). */
export function countTypes(team) {
  const counts = {};
  team.forEach(p => {
    const t = p.type || 'normal';
    counts[t] = (counts[t] || 0) + 1;
  });
  return counts;
}

/** Active trait tiers for a team. Returns [{ type, count, tier, bonus }, ...] for each type that has at least one tier active. */
export function getActiveTraits(team) {
  const counts = countTypes(team);
  const out = [];
  for (const [type, count] of Object.entries(counts)) {
    const tiers = TRAITS[type];
    if (!tiers) continue;
    let best = null;
    for (const tier of tiers) {
      if (count >= tier.count) best = { ...tier };
    }
    if (best) {
      out.push({ type, count, bonus: best });
    }
  }
  return out;
}

/** Count of each role on the field (team array). */
export function countRoles(team) {
  const counts = {};
  team.forEach(p => {
    const r = p.role || '';
    if (!r) return;
    counts[r] = (counts[r] || 0) + 1;
  });
  return counts;
}

/** Active role traits (set bonus at 2 only). */
export function getActiveRoleTraits(team) {
  const counts = countRoles(team);
  const out = [];
  for (const [role, count] of Object.entries(counts)) {
    const tiers = ROLE_TRAITS[role];
    if (!tiers) continue;
    let best = null;
    for (const t of tiers) {
      if (count >= t.count) best = { ...t };
    }
    if (best) out.push({ role, count, bonus: best });
  }
  return out;
}

/** Apply active type + role traits to a Pokémon's stats (returns new stats object for battle unit). */
export function applyTraitsToUnit(pkmn, activeTypeTraits, activeRoleTraits = []) {
  let hp = pkmn.hp;
  let atk = pkmn.atk;
  let spAtk = pkmn.spAtk != null ? pkmn.spAtk : pkmn.atk;
  let spd = pkmn.spd;
  for (const { bonus } of activeTypeTraits) {
    if (bonus.hp) hp *= bonus.hp;
    if (bonus.atk) atk *= bonus.atk;
    if (bonus.spAtk) spAtk *= bonus.spAtk;
    if (bonus.spd != null) spd *= bonus.spd;
  }
  for (const { bonus } of activeRoleTraits) {
    if (bonus.hp) hp *= bonus.hp;
    if (bonus.atk) atk *= bonus.atk;
    if (bonus.spAtk) spAtk *= bonus.spAtk;
    if (bonus.spd != null) spd *= bonus.spd;
  }
  return { ...pkmn, hp: Math.round(hp), atk: Math.round(atk), spAtk: Math.round(spAtk), spd };
}

export const LINES = [
  // Original lines (one per type) + role
  { forms: ['Bulbasaur', 'Ivysaur', 'Venusaur'], ids: [1, 2, 3], type: 'grass', role: 'Wall', cost: 1, hp: 50, atk: 12, spAtk: 14, spd: 1.0 },
  { forms: ['Charmander', 'Charmeleon', 'Charizard'], ids: [4, 5, 6], type: 'fire', role: 'Threat', cost: 1, hp: 42, atk: 14, spAtk: 16, spd: 0.9 },
  { forms: ['Squirtle', 'Wartortle', 'Blastoise'], ids: [7, 8, 9], type: 'water', role: 'Wall', cost: 1, hp: 52, atk: 14, spAtk: 10, spd: 1.0 },
  { forms: ['Pichu', 'Pikachu', 'Raichu'], ids: [172, 25, 26], type: 'electric', role: 'Speed', cost: 2, hp: 36, atk: 12, spAtk: 20, spd: 0.7 },
  { forms: ['Gastly', 'Haunter', 'Gengar'], ids: [92, 93, 94], type: 'ghost', role: 'Hazard', cost: 2, hp: 32, atk: 14, spAtk: 22, spd: 0.8 },
  { forms: ['Machop', 'Machoke', 'Machamp'], ids: [66, 67, 68], type: 'fighting', role: 'Threat', cost: 2, hp: 60, atk: 18, spAtk: 8, spd: 1.1 },
  { forms: ['Abra', 'Kadabra', 'Alakazam'], ids: [63, 64, 65], type: 'psychic', role: 'Utility', cost: 3, hp: 28, atk: 16, spAtk: 28, spd: 0.65 },
  { forms: ['Geodude', 'Graveler', 'Golem'], ids: [74, 75, 76], type: 'rock', role: 'Wall', cost: 1, hp: 65, atk: 16, spAtk: 8, spd: 1.2 },
  // One extra line per type (PokeAPI sprite IDs) + role
  { forms: ['Bellsprout', 'Weepinbell', 'Victreebel'], ids: [69, 70, 71], type: 'grass', role: 'Hazard', cost: 1, hp: 48, atk: 14, spAtk: 12, spd: 0.95 },
  { forms: ['Cyndaquil', 'Quilava', 'Typhlosion'], ids: [155, 156, 157], type: 'fire', role: 'Hazard', cost: 1, hp: 38, atk: 13, spAtk: 18, spd: 0.95 },
  { forms: ['Totodile', 'Croconaw', 'Feraligatr'], ids: [158, 159, 160], type: 'water', role: 'Threat', cost: 1, hp: 50, atk: 16, spAtk: 9, spd: 0.95 },
  { forms: ['Mareep', 'Flaaffy', 'Ampharos'], ids: [179, 180, 181], type: 'electric', role: 'Speed', cost: 2, hp: 40, atk: 10, spAtk: 22, spd: 0.75 },
  { forms: ['Shuppet', 'Banette', 'Banette'], ids: [353, 354, 354], type: 'ghost', role: 'Threat', cost: 2, hp: 34, atk: 16, spAtk: 20, spd: 0.85 },
  { forms: ['Timburr', 'Gurdurr', 'Conkeldurr'], ids: [532, 533, 534], type: 'fighting', role: 'Wall', cost: 2, hp: 55, atk: 20, spAtk: 6, spd: 1.0 },
  { forms: ['Ralts', 'Kirlia', 'Gardevoir'], ids: [280, 281, 282], type: 'psychic', role: 'Utility', cost: 3, hp: 26, atk: 14, spAtk: 26, spd: 0.7 },
  { forms: ['Aron', 'Lairon', 'Aggron'], ids: [304, 305, 306], type: 'rock', role: 'Wall', cost: 1, hp: 62, atk: 14, spAtk: 10, spd: 1.15 },
];

/** Lines that have a Mega Evolution (PokeAPI pokemon IDs for default sprites; X form for Charizard). Machamp has no mega in API. */
export const MEGA_FORMS = [
  { lineIdx: 0, name: 'Mega Venusaur', spriteId: 10033 },
  { lineIdx: 1, name: 'Mega Charizard X', spriteId: 10034 },
  { lineIdx: 2, name: 'Mega Blastoise', spriteId: 10036 },
  { lineIdx: 4, name: 'Mega Gengar', spriteId: 10038 },
  { lineIdx: 6, name: 'Mega Alakazam', spriteId: 10037 }
];

export const STAR_MULT = { 1: 1, 2: 1.9, 3: 3.5, 4: 4.2 };

let uidCounter = 0;
export function makeUid() {
  return 'p' + (++uidCounter);
}

export function spriteUrl(id) {
  return SPRITE_BASE + id + '.png';
}

function getForm(lineIdx, star) {
  const line = LINES[lineIdx];
  if (star === 4) {
    const mega = MEGA_FORMS.find(m => m.lineIdx === lineIdx);
    if (mega) {
      return {
        name: mega.name,
        spriteId: mega.spriteId,
        type: line.type,
        role: line.role || '',
        cost: line.cost
      };
    }
  }
  const formIdx = Math.min(star - 1, line.forms.length - 1);
  return {
    name: line.forms[formIdx],
    spriteId: line.ids[formIdx],
    type: line.type,
    role: line.role || '',
    cost: line.cost
  };
}

function calcStats(lineIdx, star) {
  const line = LINES[lineIdx];
  const m = STAR_MULT[star] ?? STAR_MULT[3];
  const spA = line.spAtk != null ? line.spAtk : line.atk;
  const isPhysical = line.atk > spA;
  const hpMult = isPhysical ? 1.12 : 1;
  const atkMult = isPhysical ? 0.9 : 1;
  return {
    hp: Math.round(line.hp * m * hpMult),
    atk: Math.round(line.atk * m * atkMult),
    spAtk: Math.round((line.spAtk || line.atk) * m),
    spd: line.spd / (1 + (star - 1) * 0.15)
  };
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
    role: form.role || '',
    cost: form.cost,
    hp: stats.hp,
    atk: stats.atk,
    spAtk: stats.spAtk,
    spd: stats.spd
  };
}
