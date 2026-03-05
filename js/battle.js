/** Battle loop, units, attacks, and end-of-battle flow. */

import { getState } from './state.js';
import { fieldPokemon, fieldPokemonWithPositions } from './state.js';
import { typeMult, createPokemon, spriteUrl, LINES, WIN_BONUS, TYPE_COLORS, getActiveTraits, getActiveRoleTraits, applyTraitsToUnit, FIELD_ROWS, FIELD_COLS } from './data.js';

const PROJECTILE_SPEED = 220;
const PROJECTILE_HIT_RADIUS = 14;

function generateEnemies(round) {
  const enemies = [];
  let budget = Math.floor(round * 1.8 + 2);
  while (budget > 0) {
    let star = 1;
    if (budget >= 4 && round >= 8 && Math.random() < 0.25) {
      star = 3;
      budget -= 4;
    } else if (budget >= 2 && round >= 3 && Math.random() < 0.35) {
      star = 2;
      budget -= 2;
    } else {
      budget -= 1;
    }
    enemies.push(createPokemon(Math.floor(Math.random() * LINES.length), star));
  }
  return enemies;
}

const ROW_OFFSET = 32; // x stagger per row toward center (more staggered)
const ROW_STAGGER_Y = 12; // extra y offset per row so rows don't line up vertically

function makeBattleUnit(pkmn, team, index, total, arenaW, arenaH, row = 0, col = 0) {
  const pad = 12;
  const avail = arenaH - pad * 2;
  const isRanged = (pkmn.spAtk || 0) > (pkmn.atk || 0);
  const maxRow = Math.max(1, FIELD_ROWS - 1);
  const jitter = 4;
  const baseXPlayer = 18;
  const baseXEnemy = arenaW - 88;
  const xPlayer = baseXPlayer + (maxRow - row) * ROW_OFFSET + (Math.random() * 2 - 1) * jitter;
  const xEnemy = baseXEnemy - (maxRow - row) * ROW_OFFSET + (Math.random() * 2 - 1) * jitter;
  const colSpacing = avail / Math.max(FIELD_COLS - 1, 1);
  const yFromCol = pad + col * colSpacing + (Math.random() * 2 - 1) * 3;
  const yStagger = row * ROW_STAGGER_Y;
  const y = yFromCol + yStagger;
  return {
    ...pkmn,
    team,
    row,
    col,
    x: team === 'player' ? xPlayer : xEnemy,
    y,
    currentHp: pkmn.hp,
    maxHp: pkmn.hp,
    atkTimer: Math.random() * pkmn.spd * 0.5,
    target: null,
    element: null,
    isRanged
  };
}

/** Pick target: prefer front row (row 0) then next rows, then by distance. */
function nearestUnit(unit, list) {
  const alive = list.filter(f => f.currentHp > 0);
  if (alive.length === 0) return null;
  alive.sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    const dA = Math.hypot(a.x - unit.x, a.y - unit.y);
    const dB = Math.hypot(b.x - unit.x, b.y - unit.y);
    return dA - dB;
  });
  return alive[0];
}

function spawnProjectile(attacker, target, arenaEl, projectiles) {
  const mult = typeMult(attacker.type, target.type);
  const dmg = Math.max(1, Math.round((attacker.spAtk || attacker.atk) * mult));
  const dx = target.x + 22 - attacker.x - 22;
  const dy = target.y + 22 - attacker.y - 22;
  const dist = Math.hypot(dx, dy) || 1;
  const vx = (dx / dist) * PROJECTILE_SPEED;
  const vy = (dy / dist) * PROJECTILE_SPEED;

  const el = document.createElement('div');
  el.className = 'battle-projectile';
  el.style.left = (attacker.x + 22 - 8) + 'px';
  el.style.top = (attacker.y + 22 - 8) + 'px';
  el.style.backgroundColor = TYPE_COLORS[attacker.type] || '#aaa';
  el.style.color = TYPE_COLORS[attacker.type] || '#aaa';
  arenaEl.appendChild(el);

  projectiles.push({
    x: attacker.x + 22,
    y: attacker.y + 22,
    tx: target.x + 22,
    ty: target.y + 22,
    vx,
    vy,
    target,
    dmg,
    mult,
    element: el
  });
}

function showDamageNumber(target, dmg, mult, arenaEl) {
  const numEl = document.createElement('div');
  numEl.className = 'damage-number' + (mult > 1 ? ' effective' : '');
  numEl.textContent = dmg;
  numEl.style.left = (target.x + 8) + 'px';
  numEl.style.top = (target.y - 5) + 'px';
  arenaEl.appendChild(numEl);
  if (window.anime) {
    window.anime({
      targets: numEl,
      translateY: -70,
      opacity: [1, 0],
      scale: [1, 1.4],
      duration: 1400,
      easing: 'easeOutCubic',
      complete: () => numEl.remove()
    });
  } else {
    setTimeout(() => numEl.remove(), 1400);
  }
}

function applyDamageToTarget(target, dmg, mult, arenaEl) {
  target.currentHp = Math.max(0, target.currentHp - dmg);
  showDamageNumber(target, dmg, mult, arenaEl);
  if (target.currentHp <= 0 && target.element) target.element.classList.add('fainted');
  updateBattleUnitEl(target);
}

function performAttack(attacker, target, arenaEl) {
  const mult = typeMult(attacker.type, target.type);
  const dmg = Math.max(1, Math.round(attacker.atk * mult));
  applyDamageToTarget(target, dmg, mult, arenaEl);

  if (attacker.element) {
    const img = attacker.element.querySelector('img') || attacker.element;
    if (window.anime) {
      window.anime({
        targets: img,
        scale: [
          { value: 1.6, duration: 120, easing: 'easeOutQuad' },
          { value: 1.0, duration: 280, easing: 'easeOutElastic(1, 0.6)' }
        ]
      });
    } else {
      attacker.element.classList.add('attacking');
      setTimeout(() => attacker.element && attacker.element.classList.remove('attacking'), 100);
    }
  }

}

function createBattleUnitEl(unit) {
  const el = document.createElement('div');
  el.className = 'battle-unit' + (unit.team === 'enemy' ? ' enemy' : '');

  const img = document.createElement('img');
  img.src = spriteUrl(unit.spriteId);
  el.appendChild(img);

  const stars = document.createElement('div');
  stars.style.cssText = 'font-size:8px;color:' + (unit.star >= 3 ? '#ff4444' : 'var(--gold)');
  stars.textContent = '★'.repeat(unit.star);
  el.appendChild(stars);

  const hpWrap = document.createElement('div');
  hpWrap.className = 'unit-hp-bar';
  const hpFill = document.createElement('div');
  hpFill.className = 'unit-hp-fill';
  hpWrap.appendChild(hpFill);
  el.appendChild(hpWrap);

  return el;
}

function updateBattleUnitEl(unit) {
  if (!unit.element) return;
  unit.element.style.left = unit.x + 'px';
  unit.element.style.top = unit.y + 'px';
  const fill = unit.element.querySelector('.unit-hp-fill');
  if (fill) {
    const pct = Math.max(0, (unit.currentHp / unit.maxHp) * 100);
    if (window.anime) {
      window.anime({
        targets: fill,
        width: pct + '%',
        duration: 550,
        easing: 'easeOutQuad'
      });
    } else {
      fill.style.width = pct + '%';
    }
    fill.classList.toggle('low', pct < 35);
  }
}

export function startBattle(opts) {
  const G = getState();
  if (G.phase !== 'prep') return;
  const teamWithPos = fieldPokemonWithPositions();
  if (teamWithPos.length === 0) return;
  const team = teamWithPos.map(({ pkmn }) => pkmn);

  G.phase = 'battle';
  G.selected = null;
  G.battleOver = false;
  document.getElementById('round-info').classList.remove('active');

  const arenaEl = document.getElementById('arena');
  arenaEl.classList.add('active');
  arenaEl.querySelectorAll('.battle-unit, .damage-number, .battle-result-overlay, .battle-projectile').forEach(e => e.remove());

  const arenaW = arenaEl.offsetWidth;
  const arenaH = arenaEl.offsetHeight;

  const enemies = generateEnemies(G.round);
  const playerTypeTraits = getActiveTraits(team);
  const playerRoleTraits = getActiveRoleTraits(team);
  const playerUnits = teamWithPos.map(({ pkmn, r, c }, i) => {
    const buffed = applyTraitsToUnit(pkmn, playerTypeTraits, playerRoleTraits);
    return makeBattleUnit(buffed, 'player', i, teamWithPos.length, arenaW, arenaH, r, c);
  });
  const enemyUnits = enemies.map((p, i) => makeBattleUnit(p, 'enemy', i, enemies.length, arenaW, arenaH, Math.floor(i / FIELD_COLS), i % FIELD_COLS));

  G.battleUnits = [...playerUnits, ...enemyUnits];
  G.battleProjectiles = [];
  G.battleUnits.forEach(u => {
    u.element = createBattleUnitEl(u);
    arenaEl.appendChild(u.element);
    updateBattleUnitEl(u);
  });

  opts.onRender();
  let lastTime = performance.now();

  function endBattle(playerWon, surviving) {
    G.battleOver = true;
    if (G.battleAnimId) cancelAnimationFrame(G.battleAnimId);

    let hpLost = 0;
    if (!playerWon) {
      surviving.forEach(e => {
        hpLost += e.star * 3 + G.round;
      });
      G.hp = Math.max(0, G.hp - hpLost);
      G.streak = 0;
    } else {
      G.gold += WIN_BONUS;
      G.streak++;
      if (G.streak >= 3) G.gold += 1;
    }

    const ov = document.createElement('div');
    ov.className = 'battle-result-overlay';
    ov.innerHTML = playerWon
      ? `<h2 class="win">VICTORY!</h2><p>+${WIN_BONUS}${G.streak >= 3 ? '+1 streak' : ''} gold</p>`
      : `<h2 class="lose">DEFEAT</h2><p>-${hpLost} HP</p>`;
    arenaEl.appendChild(ov);
    opts.onRender();

    setTimeout(() => {
      arenaEl.classList.remove('active');
      arenaEl.querySelectorAll('.battle-unit, .damage-number, .battle-result-overlay, .battle-projectile').forEach(e => e.remove());
      if (G.hp <= 0) opts.onGameOver();
      else opts.onRoundStart();
    }, 2000);
  }

  function tick(now) {
    if (G.battleOver) return;
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    const alive = G.battleUnits.filter(u => u.currentHp > 0);
    const friends = alive.filter(u => u.team === 'player');
    const foes = alive.filter(u => u.team === 'enemy');

    if (friends.length === 0 || foes.length === 0) {
      endBattle(friends.length > 0, foes);
      return;
    }

    const projectiles = G.battleProjectiles;
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.x += p.vx * dt * G.battleSpeed;
      p.y += p.vy * dt * G.battleSpeed;
      p.element.style.left = (p.x - 8) + 'px';
      p.element.style.top = (p.y - 8) + 'px';
      const distToTarget = Math.hypot(p.tx - p.x, p.ty - p.y);
      if (distToTarget < PROJECTILE_HIT_RADIUS || p.target.currentHp <= 0) {
        if (p.target.currentHp > 0) applyDamageToTarget(p.target, p.dmg, p.mult, arenaEl);
        p.element.remove();
        projectiles.splice(i, 1);
      }
    }

    alive.forEach(u => {
      const targets = u.team === 'player' ? foes : friends;
      if (!u.target || u.target.currentHp <= 0) u.target = nearestUnit(u, targets);
      if (!u.target) return;

      if (u.isRanged) {
        u.atkTimer += dt * G.battleSpeed;
        if (u.atkTimer >= u.spd) {
          u.atkTimer = 0;
          spawnProjectile(u, u.target, arenaEl, projectiles);
        }
        updateBattleUnitEl(u);
        return;
      }

      const dx = u.target.x - u.x;
      const dy = u.target.y - u.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 48) {
        const spd = 80 * G.battleSpeed;
        u.x += (dx / dist) * spd * dt;
        u.y += (dy / dist) * spd * dt;
      } else {
        u.atkTimer += dt * G.battleSpeed;
        if (u.atkTimer >= u.spd) {
          u.atkTimer = 0;
          performAttack(u, u.target, arenaEl);
        }
      }
      updateBattleUnitEl(u);
    });

    G.battleAnimId = requestAnimationFrame(tick);
  }
  G.battleAnimId = requestAnimationFrame(tick);
}
