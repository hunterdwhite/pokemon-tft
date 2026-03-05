/** Battle loop, units, attacks, and end-of-battle flow. */

import { getState } from './state.js';
import { fieldPokemon } from './state.js';
import { typeMult, createPokemon, spriteUrl, LINES, WIN_BONUS } from './data.js';

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

function makeBattleUnit(pkmn, team, index, total, arenaW, arenaH) {
  const unitH = 65;
  const pad = 12;
  const avail = arenaH - pad * 2;
  const spacing = Math.min(avail / Math.max(total, 1), unitH);
  const totalH = spacing * total;
  const startY = (arenaH - totalH) / 2;
  return {
    ...pkmn,
    team,
    x: team === 'player' ? 25 + Math.random() * 20 : arenaW - 80 + Math.random() * 20,
    y: startY + spacing * index,
    currentHp: pkmn.hp,
    maxHp: pkmn.hp,
    atkTimer: Math.random() * pkmn.spd * 0.5,
    target: null,
    element: null
  };
}

function nearestUnit(unit, list) {
  let best = null;
  let bestD = Infinity;
  list.forEach(f => {
    if (f.currentHp <= 0) return;
    const d = Math.hypot(f.x - unit.x, f.y - unit.y);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  });
  return best;
}

function performAttack(attacker, target, arenaEl) {
  const mult = typeMult(attacker.type, target.type);
  const dmg = Math.max(1, Math.round(attacker.atk * mult));
  target.currentHp = Math.max(0, target.currentHp - dmg);

  if (attacker.element) {
    attacker.element.classList.add('attacking');
    setTimeout(() => attacker.element && attacker.element.classList.remove('attacking'), 100);
  }

  const numEl = document.createElement('div');
  numEl.className = 'damage-number' + (mult > 1 ? ' effective' : '');
  numEl.textContent = dmg;
  numEl.style.left = (target.x + 8) + 'px';
  numEl.style.top = (target.y - 5) + 'px';
  arenaEl.appendChild(numEl);
  setTimeout(() => numEl.remove(), 800);

  if (target.currentHp <= 0 && target.element) target.element.classList.add('fainted');
  updateBattleUnitEl(target);
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
    fill.style.width = pct + '%';
    fill.classList.toggle('low', pct < 35);
  }
}

export function startBattle(opts) {
  const G = getState();
  if (G.phase !== 'prep') return;
  const team = fieldPokemon();
  if (team.length === 0) return;

  G.phase = 'battle';
  G.selected = null;
  G.battleOver = false;
  document.getElementById('round-info').classList.remove('active');

  const arenaEl = document.getElementById('arena');
  arenaEl.classList.add('active');
  arenaEl.querySelectorAll('.battle-unit, .damage-number, .battle-result-overlay').forEach(e => e.remove());

  const arenaW = arenaEl.offsetWidth;
  const arenaH = arenaEl.offsetHeight;

  const enemies = generateEnemies(G.round);
  const playerUnits = team.map((p, i) => makeBattleUnit(p, 'player', i, team.length, arenaW, arenaH));
  const enemyUnits = enemies.map((p, i) => makeBattleUnit(p, 'enemy', i, enemies.length, arenaW, arenaH));

  G.battleUnits = [...playerUnits, ...enemyUnits];
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
      arenaEl.querySelectorAll('.battle-unit, .damage-number, .battle-result-overlay').forEach(e => e.remove());
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

    alive.forEach(u => {
      const targets = u.team === 'player' ? foes : friends;
      if (!u.target || u.target.currentHp <= 0) u.target = nearestUnit(u, targets);
      if (!u.target) return;

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
