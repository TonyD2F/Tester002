// ---------------------------------------------------------------------------
// Game — match lifecycle, projectiles, effects, camera and scoring.
// ---------------------------------------------------------------------------
import { Fighter } from './fighter.js';
import { AIBrain } from './ai.js';
import { STAGE_MAP, BLAST, SLOT_COLORS, SLOT_NAMES } from './data.js';
import { audio } from './audio.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const EMPTY_INPUT = { held: new Set(), pressed: new Set() };

export class Game {
  constructor() {
    this.phase = 'idle';
    this.fighters = [];
    this.projectiles = [];
    this.particles = [];
    this.popups = [];
    this.announcement = null;
    this.stage = STAGE_MAP.sky;
    this.config = null;
    this.time = 0;
    this.clock = 0;
    this.hitstop = 0;
    this.shake = 0;
    this.screenFlash = 0;
    this.flashColor = '#ffffff';
    this.camera = { x: 0, y: -80, zoom: 1, punch: 0 };
    this.view = { w: 1280, h: 720 };
    this.countdown = 0;
    this.overTimer = 0;
    this.ending = false;
    this.results = null;
    this.elimOrder = [];
    this.onEnd = null;
    this.ais = [];
    this.initialized = false;
    this.slowmo = 0;
    this.matchSeed = Math.random() * 1000;
  }

  start(config, onEnd) {
    this.config = {
      ...config,
      slots: config.slots.map((s) => ({ ...s })),
    };
    this.stage = STAGE_MAP[config.stage] || STAGE_MAP.sky;
    this.fighters = [];
    this.projectiles = [];
    this.particles = [];
    this.popups = [];
    this.announcement = null;
    this.ais = [];
    this.elimOrder = [];
    this.results = null;
    this.onEnd = onEnd || null;
    this.time = 0;
    this.clock = 0;
    this.hitstop = 0;
    this.shake = 0;
    this.screenFlash = 0;
    this.ending = false;
    this.overTimer = 0;
    this.phase = 'countdown';
    this.countdown = 0;
    this.camera = { x: 0, y: -90, zoom: 1, punch: 0 };
    this.initialized = true;

    config.slots.forEach((slot, index) => {
      if (slot.type === 'off') return;
      const f = new Fighter(index, slot.char, slot.type, config.difficulty, this.stage);
      f.prepareMatch(this.stage, config.stocks);
      f.invincible = 70;
      this.fighters.push(f);
      if (slot.type === 'cpu') this.ais.push(new AIBrain(f, config.difficulty));
    });

    for (const f of this.fighters) {
      this.ring(f.x, f.y - 30, f.color, 40);
      this.burst(f.x, f.y - 40, f.color, 8, 3);
    }
    this.updateCamera(true);
    this.announce('3', this.stage.name, '#ffffff', 22);
    this.countdownStep = 0;
    audio.beep(false);
  }

  restart() {
    if (!this.config) return;
    const cb = this.onEnd;
    this.start(this.config, cb);
  }

  announce(text, sub = '', color = '#ffffff', life = 62) {
    this.announcement = {
      text, sub, color, life, maxLife: life, id: Math.random(),
    };
  }

  // -------------------------------------------------------------------------
  update(humanInputs = []) {
    if (!this.initialized) return;
    this.time++;
    this.updateParticles();
    this.updatePopups();

    if (this.announcement) {
      this.announcement.life--;
      if (this.announcement.life <= 0) this.announcement = null;
    }
    this.shake *= 0.88;
    if (this.shake < 0.15) this.shake = 0;
    this.screenFlash = Math.max(0, this.screenFlash - 0.035);
    this.camera.punch *= 0.9;

    if (this.phase === 'countdown') {
      this.countdown++;
      this.updateFightersCountdown();
      this.updateCamera();
      this.tickCountdown();
      return;
    }

    if (this.phase === 'over') {
      this.overTimer--;
      this.updateFightersIdle(humanInputs);
      this.updateProjectiles();
      this.updateCamera();
      if (this.overTimer <= 0) this.finish();
      return;
    }

    if (this.phase === 'ended') {
      this.updateCamera();
      return;
    }

    this.clock++;

    if (this.hitstop > 0) {
      this.hitstop--;
      this.updateCamera();
      return;
    }

    for (const f of this.fighters) {
      let input = EMPTY_INPUT;
      if (!f.eliminated && f.koTimer <= 0) {
        if (f.kind === 'cpu') {
          const brain = this.ais.find((a) => a.f === f);
          input = brain ? brain.update(this) : EMPTY_INPUT;
        } else {
          input = humanInputs[f.slot] || EMPTY_INPUT;
        }
      }
      f.update(input, this);
    }
    this.updateProjectiles();
    this.checkEnd();
    this.updateCamera();
  }

  updateFightersCountdown() {
    for (const f of this.fighters) {
      if (f.eliminated) continue;
      f.update(EMPTY_INPUT, this);
    }
  }

  updateFightersIdle(inputs) {
    for (const f of this.fighters) {
      f.update(EMPTY_INPUT, this);
    }
  }

  tickCountdown() {
    const marks = [0, 26, 52, 78];
    const labels = ['3', '2', '1'];
    if (this.countdown === marks[1] - 0) {
      this.announce('2', this.stage.name, '#ffffff', 22);
      audio.beep(false);
    } else if (this.countdown === marks[2]) {
      this.announce('1', this.stage.name, '#ffe08a', 22);
      audio.beep(false);
    } else if (this.countdown === marks[3]) {
      this.phase = 'fight';
      this.announce('GO!', '', '#b6ff5c', 34);
      audio.beep(true);
      audio.announce();
    }
  }

  checkEnd() {
    if (this.ending) return;
    const alive = this.fighters.filter((f) => f.stocks > 0 && !f.eliminated);
    if (alive.length <= 1 && this.fighters.length >= 2) {
      this.ending = true;
      this.phase = 'over';
      this.overTimer = 112;
      const winner = alive[0];
      for (const f of alive) f.invincible = Math.max(f.invincible, 220);
      if (winner) {
        this.announce('GAME!', `${winner.tag} WINS`, winner.color, 110);
      } else {
        this.announce('GAME!', 'DOUBLE KO', '#ffd75e', 110);
      }
      this.screenFlash = 0.4;
      this.flashColor = '#ffffff';
      for (let i = 0; i < 30; i++) {
        this.addParticle({
          type: 'confetti', x: (Math.random() - 0.5) * 900, y: -420 - Math.random() * 300,
          vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 3, size: 4 + Math.random() * 5,
          color: ['#ffd75e', '#ff7a3d', '#ff3d8b', '#45e3ff', '#b6ff5c'][i % 5],
          life: 180 + Math.random() * 80, maxLife: 240, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.2,
        });
      }
      audio.win();
    }
  }

  finish() {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.results = this.buildResults();
    if (this.onEnd) this.onEnd(this.results);
  }

  buildResults() {
    const survivors = this.fighters
      .filter((f) => f.stocks > 0 && !f.eliminated)
      .sort((a, b) => b.stocks - a.stocks || a.damage - b.damage);
    const eliminated = this.elimOrder
      .slice()
      .reverse()
      .map((slot) => this.fighters.find((f) => f.slot === slot))
      .filter(Boolean);
    // Keep the results complete even if a fighter left play without going
    // through the usual blast-zone elimination path.
    const listed = new Set([...survivors, ...eliminated].map((f) => f.slot));
    for (const f of this.fighters) {
      if (!listed.has(f.slot)) {
        eliminated.push(f);
        listed.add(f.slot);
      }
    }
    const ordered = [...survivors, ...eliminated];
    const rows = ordered.map((f, i) => ({
      slot: f.slot,
      tag: f.tag,
      charId: f.charId,
      charName: f.char.name,
      kind: f.kind,
      color: f.color,
      placement: i + 1,
      stocks: f.stocks,
      damage: Math.round(f.damage),
      kos: f.stats.kos,
      falls: f.stats.falls,
      dealt: Math.round(f.stats.dealt),
    }));
    return {
      rows,
      winner: survivors[0] ? rows[0] : null,
      winnerSlot: survivors[0] ? survivors[0].slot : null,
      duration: this.clock,
      stage: this.stage,
    };
  }

  // -------------------------------------------------------------------------
  respawnFx(f) {
    this.ring(f.x, f.y - 40, f.color, 90);
    this.ring(f.x, f.y - 40, '#ffffff', 50);
    this.burst(f.x, f.y - 40, f.color, 14, 5);
  }

  onHit(attacker, victim, dmg) {
    const color = attacker ? attacker.char.palette.glow : '#ffffff';
    const heavy = dmg > 13;
    this.burst(victim.x, victim.y - 44, '#fff3d0', heavy ? 14 : 8, heavy ? 7 : 4.5);
    this.burst(victim.x, victim.y - 44, color, heavy ? 8 : 4, 5);
    this.sparkArc(victim.x, victim.y - 46, Math.atan2(victim.vy, victim.vx), color, heavy);
    this.popup(victim.x, victim.y - 78, `${Math.ceil(dmg)}`, dmg >= 18 ? '#ff5470' : dmg >= 11 ? '#ffb347' : '#fff3d0', heavy ? 1.25 : 1);
    if (attacker) {
      const card = document.querySelector(`.hud-card[data-slot="${victim.slot}"]`);
      if (card) {
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
      }
    }
  }

  onShieldHit(attacker, victim) {
    this.burst(victim.x, victim.y - 48, '#8fe9ff', 8, 4);
    this.ring(victim.x, victim.y - 46, '#8fe9ff', 30);
    this.popup(victim.x, victim.y - 82, 'BLOCK', '#8fe9ff', 0.8);
    this.shake = Math.max(this.shake, 3);
  }

  onCounter(defender, attacker) {
    this.ring(defender.x, defender.y - 45, '#ffffff', 56);
    this.burst(defender.x, defender.y - 45, defender.char.palette.glow, 18, 6);
    this.popup(defender.x, defender.y - 95, 'COUNTER!', defender.char.palette.glow, 1.1);
    this.screenFlash = Math.max(this.screenFlash, 0.3);
    this.flashColor = '#ffffff';
    this.shake = Math.max(this.shake, 8);
  }

  onKO(fighter, killer) {
    const x = clamp(fighter.x, BLAST.left + 40, BLAST.right - 40);
    const y = clamp(fighter.y, BLAST.top + 60, BLAST.bottom - 40);
    for (let i = 0; i < 26; i++) {
      this.addParticle({
        type: 'spark', x, y,
        vx: (Math.random() - 0.5) * 24, vy: (Math.random() - 0.5) * 24,
        life: 28 + Math.random() * 28, maxLife: 56, size: 2 + Math.random() * 5,
        color: ['#ffffff', '#ffd75e', '#ff7a3d', fighter.color][i % 4], grav: 0.25,
      });
    }
    for (let i = 0; i < 8; i++) {
      this.addParticle({
        type: 'ring', x, y, vx: 0, vy: 0, life: 26 + i * 4, maxLife: 56,
        size: 20 + i * 14, color: i % 2 ? fighter.color : '#ffffff', grav: 0,
      });
    }
    this.addParticle({
      type: 'beam', x, y, vx: 0, vy: 0, life: 38, maxLife: 38, size: 220,
      color: fighter.color, grav: 0, rot: Math.atan2(y, x) + Math.PI / 2,
    });
    this.popup(x, y - 30, 'KO!', '#fff', 1.6);
    this.shake = 18;
    this.screenFlash = 0.72;
    this.flashColor = '#fff6e6';
    this.hitstop = Math.max(this.hitstop, 14);
    this.camera.punch = 0.1;
    audio.ko();
    if (killer && killer !== fighter) killer.stats.kos++;
    if (fighter.stocks <= 0) {
      this.elimOrder.push(fighter.slot);
      this.announce('ELIMINATED', `${fighter.tag} · ${fighter.char.name}`, fighter.color, 60);
    } else {
      this.announce('KO!', `${fighter.tag} LOSES A STOCK`, fighter.color, 46);
    }
  }

  // -------------------------------------------------------------------------
  updateProjectiles() {
    const keep = [];
    for (const p of this.projectiles) {
      p.life--;
      if (p.life <= 0) continue;
      p.vy += p.gravity;
      const prevY = p.y;
      p.x += p.vx;
      p.y += p.vy;
      p.rot = (p.rot || 0) + (p.kind === 'seed' ? 0.18 : 0.35);
      if (Math.random() < 0.55) {
        this.addParticle({
          type: 'trail', x: p.x, y: p.y, vx: -p.vx * 0.08, vy: -p.vy * 0.08,
          life: 12, maxLife: 12, size: p.r * 0.7, color: p.color, grav: 0,
        });
      }
      // bounce seed or projectile off the main stage surface
      let bounced = false;
      for (const plat of this.stage.platforms) {
        const half = plat.w / 2;
        if (p.x < plat.x - half || p.x > plat.x + half) continue;
        if (prevY <= plat.y && p.y >= plat.y && p.vy > 0) {
          if (p.bounce > 0) {
            p.y = plat.y - 1;
            p.vy = -Math.abs(p.vy) * 0.62;
            p.vx *= 0.86;
            p.bounce--;
            bounced = true;
            this.dust(p.x, plat.y, 0, p.color, 3);
            break;
          }
          if (p.kind === 'seed') {
            this.burst(p.x, plat.y - 8, p.color, 8, 3);
            p.life = 0;
            break;
          }
        }
      }
      if (bounced) { keep.push(p); continue; }
      if (p.life <= 0) continue;

      // bounds
      if (p.x < BLAST.left || p.x > BLAST.right || p.y < BLAST.top || p.y > BLAST.bottom) continue;

      // projectile vs projectile
      let clashed = false;
      for (const q of keep) {
        if (q.owner === p.owner) continue;
        if (Math.hypot(q.x - p.x, q.y - p.y) < q.r + p.r) {
          this.burst((p.x + q.x) / 2, (p.y + q.y) / 2, '#ffffff', 10, 4);
          this.ring((p.x + q.x) / 2, (p.y + q.y) / 2, '#8fe9ff', 24);
          q.life = 0;
          clashed = true;
          break;
        }
      }
      if (clashed) { p.life = 0; continue; }

      // projectile vs fighters
      for (const f of this.fighters) {
        if (f.eliminated || f.koTimer > 0 || f.slot === p.owner) continue;
        const box = f.hurtbox();
        if (circleRect(p.x, p.y, p.r, box)) {
          if (f.isCountering()) {
            const priorOwner = p.owner;
            p.owner = f.slot;
            p.vx *= -1.4;
            p.vy = -Math.abs(p.vy) * 0.7 - 1;
            p.damage *= 1.35;
            p.speed = Math.abs(p.vx);
            p.life = Math.max(40, p.life);
            p.color = f.char.palette.glow;
            this.burst(p.x, p.y, '#ffffff', 12, 6);
            this.onCounter(f, this.fighters.find((x) => x.slot === priorOwner));
            audio.counter();
            p.x += p.vx * 2;
            break;
          }
          const move = {
            damage: p.damage, baseKB: p.baseKB, growth: p.growth, angle: p.angle,
          };
          const owner = this.fighters.find((x) => x.slot === p.owner);
          const dir = Math.sign(p.vx) || 1;
          const res = f.takeHit(move, owner, 1, this, { dir });
          if (res === 'hit') {
            if (owner) owner.stats.dealt += p.damage;
            this.hitstop = Math.max(this.hitstop, 3);
            this.onHit(owner, f, p.damage);
          } else if (res === 'shield') {
            this.onShieldHit(owner, f);
            this.hitstop = Math.max(this.hitstop, 2);
          } else if (res === 'countered') {
            this.hitstop = Math.max(this.hitstop, 5);
          }
          p.life = 0;
          break;
        }
      }
      if (p.life > 0) keep.push(p);
    }
    this.projectiles = keep;
  }

  // -------------------------------------------------------------------------
  updateCamera(instant = false) {
    const live = this.fighters.filter((f) => f.alive && f.koTimer <= 0);
    const vw = this.view.w || 1280;
    const vh = this.view.h || 720;
    const base = vh / 720;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    if (live.length) {
      for (const f of live) {
        minX = Math.min(minX, f.x);
        maxX = Math.max(maxX, f.x);
        minY = Math.min(minY, f.y - 100);
        maxY = Math.max(maxY, f.y);
      }
    } else {
      minX = -300; maxX = 300; minY = -260; maxY = 0;
    }
    const spreadX = Math.max(520, maxX - minX + 480);
    const spreadY = Math.max(420, maxY - minY + 380);
    let zoomX = (vw * 0.92) / (spreadX * base);
    let zoomY = (vh * 0.82) / (spreadY * base);
    let zoom = Math.min(zoomX, zoomY, 1.16);
    zoom = clamp(zoom, 0.42, 1.16);
    if (live.length === 1) zoom = Math.min(zoom, 0.95);

    const tx = (minX + maxX) / 2;
    const ty = (minY + maxY) / 2 - 24;
    const ease = instant ? 1 : 0.09;
    this.camera.x += (tx - this.camera.x) * ease;
    this.camera.y += (ty - this.camera.y) * ease;
    this.camera.zoom += (zoom - this.camera.zoom) * (instant ? 1 : 0.06);
  }

  // -------------------------------------------------------------------------
  addParticle(p) {
    if (this.particles.length > 420) this.particles.shift();
    this.particles.push(p);
  }

  updateParticles() {
    const keep = [];
    for (const p of this.particles) {
      p.life--;
      if (p.life <= 0) continue;
      p.vy += p.grav || 0;
      p.vx *= p.drag ?? 0.98;
      p.x += p.vx;
      p.y += p.vy;
      if (p.vr) p.rot = (p.rot || 0) + p.vr;
      if (p.type === 'ring') p.size += p.grow || 6;
      if (p.type === 'confetti' && p.y > 420) p.life = 0;
      keep.push(p);
    }
    this.particles = keep;
  }

  updatePopups() {
    const keep = [];
    for (const p of this.popups) {
      p.life--;
      p.y -= 1.1;
      p.vy += 0.02;
      if (p.life > 0) keep.push(p);
    }
    this.popups = keep;
  }

  dust(x, y, dir, color = '#e9e4ff', count = 4) {
    for (let i = 0; i < count; i++) {
      this.addParticle({
        type: 'dust', x: x + (Math.random() - 0.5) * 12, y: y - Math.random() * 6,
        vx: (dir || (Math.random() - 0.5)) * (0.6 + Math.random() * 2.2),
        vy: -Math.random() * 1.8, life: 18 + Math.random() * 16, maxLife: 34,
        size: 6 + Math.random() * 9, color, grav: -0.015, drag: 0.94,
      });
    }
  }

  burst(x, y, color, count = 8, power = 4) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = power * (0.4 + Math.random());
      this.addParticle({
        type: Math.random() < 0.6 ? 'spark' : 'star',
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6,
        life: 14 + Math.random() * 22, maxLife: 36, size: 2 + Math.random() * 4,
        color, grav: 0.12, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.5,
      });
    }
  }

  ring(x, y, color, size = 30) {
    this.addParticle({
      type: 'ring', x, y, vx: 0, vy: 0, life: 22, maxLife: 22,
      size: size * 0.25, color, grav: 0, grow: size * 0.06,
    });
  }

  sparkArc(x, y, angle, color, heavy) {
    this.addParticle({
      type: 'slash', x, y, vx: 0, vy: 0, life: heavy ? 12 : 8, maxLife: heavy ? 12 : 8,
      size: heavy ? 58 : 34, color: '#ffffff', grav: 0, rot: angle,
    });
    this.addParticle({
      type: 'slash', x, y, vx: 0, vy: 0, life: heavy ? 14 : 9, maxLife: 14,
      size: heavy ? 44 : 26, color, grav: 0, rot: angle + 0.5,
    });
  }

  trailGhost(f) {
    this.addParticle({
      type: 'ghost', x: f.x, y: f.y, vx: 0, vy: 0, life: 14, maxLife: 14,
      size: 1, color: f.char.palette.glow, grav: 0,
      char: f.charId, facing: f.facing, slot: f.slot,
    });
  }

  chargeSpark(f) {
    const a = Math.random() * Math.PI * 2;
    const r = 26 + Math.random() * 26;
    this.addParticle({
      type: 'charge', x: f.x + Math.cos(a) * r, y: f.y - 48 + Math.sin(a) * r * 0.8,
      vx: -Math.cos(a) * 1.6, vy: -Math.sin(a) * 1.6, life: 14, maxLife: 14,
      size: 2 + Math.random() * 3, color: f.char.palette.glow, grav: 0, drag: 0.98,
    });
  }

  whiffSpark(x, y) {
    this.addParticle({
      type: 'ring', x, y, vx: 0, vy: 0, life: 12, maxLife: 12,
      size: 16, color: 'rgba(255,255,255,0.7)', grav: 0, grow: 2.4,
    });
  }

  popup(x, y, text, color, scale = 1) {
    this.popups.push({
      x, y, text, color, scale,
      life: 44, maxLife: 44, vy: 0,
    });
  }

  spawnProjectile(owner, spec) {
    const dir = owner.facing;
    const kind = spec.kind;
    this.projectiles.push({
      kind,
      owner: owner.slot,
      x: owner.x + (spec.ox || 30) * dir,
      y: owner.y + (spec.oy || -62),
      vx: (spec.speed || 9) * dir,
      vy: spec.vy || 0,
      gravity: spec.gravity || 0,
      r: spec.r || 11,
      damage: spec.damage,
      baseKB: spec.baseKB,
      growth: spec.growth,
      angle: spec.angle,
      life: spec.life || 110,
      maxLife: spec.life || 110,
      bounce: spec.bounce || 0,
      color: owner.char.palette.glow,
      rot: 0,
      dir,
    });
  }

  formatTime() {
    const secs = Math.floor(this.clock / 60);
    const m = Math.floor(secs / 60);
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  }
}

function circleRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}
