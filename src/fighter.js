// ---------------------------------------------------------------------------
// Fighter — platform physics, attacks, shielding, knockback and stocks.
// ---------------------------------------------------------------------------
import {
  BLAST, GRAVITY, MAX_FALL, MAX_CHARGE, CHAR_MAP, SLOT_COLORS, SLOT_NAMES,
} from './data.js';
import { audio } from './audio.js';

const DEG = Math.PI / 180;
const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'special', 'shield', 'dodge'];

function has(set, action) { return Boolean(set && set.has(action)); }

export class Fighter {
  constructor(slot, charId, kind, difficulty, stage) {
    this.slot = slot;
    this.id = slot;
    this.charId = charId;
    this.char = CHAR_MAP[charId] || CHAR_MAP.blaze;
    this.kind = kind; // human | cpu
    this.difficulty = difficulty || 2;
    this.color = SLOT_COLORS[slot];
    this.tag = SLOT_NAMES[slot];
    this.stocks = 3;
    this.stage = stage;
    this.spawn = stage.spawns[slot] || stage.spawns[0];
    this.time = 0;
    this.stats = { kos: 0, falls: 0, dealt: 0, taken: 0 };
    this.reset(stage, 3);
  }

  reset(stage, stocks) {
    this.stage = stage;
    this.spawn = stage.spawns[this.slot] || stage.spawns[0];
    this.stocks = stocks;
    this.x = this.spawn.x;
    this.y = this.spawn.y;
    this.vx = 0;
    this.vy = 0;
    this.facing = this.spawn.x <= 0 ? 1 : -1;
    this.grounded = true;
    this.wasGrounded = true;
    this.jumpsLeft = 2;
    this.damage = 0;
    this.action = null;
    this.move = null;
    this.moveKey = null;
    this.attackFrame = 0;
    this.charge = 0;
    this.charging = false;
    this.chargeFx = 0;
    this.hitTargets = new Set();
    this.spawned = new Set();
    this.hitstun = 0;
    this.hitstop = 0;
    this.invincible = 0;
    this.helpless = false;
    this.shieldHP = 100;
    this.shieldstun = 0;
    this.shieldTimer = 0;
    this.shieldbroken = 0;
    this.dodgeTimer = 0;
    this.dodgeDuration = 0;
    this.dodgeIframes = 0;
    this.airDodgeUsed = false;
    this.fastfall = false;
    this.cutJump = false;
    this.floatTimer = 0;
    this.koTimer = 0;
    this.eliminated = false;
    this.hitFlash = 0;
    this.counterFlash = 0;
    this.respawnGlow = 0;
    this.lastHitBy = null;
    this.lastHitMove = null;
    this.trail = [];
    this.runPhase = 0;
    this.animTime = Math.random() * 100;
    this.tumble = false;
    this.jabWindow = 0;
    this.armor = false;
    this.crouching = false;
    this.landSquash = 0;
    this.dustTimer = 0;
    this.damageDealtThisLife = 0;
    this.stats = { kos: 0, falls: 0, dealt: 0, taken: 0 };
  }

  get alive() { return !this.eliminated && this.stocks > 0; }
  get isCPU() { return this.kind === 'cpu'; }
  get power() { return this.char.physics; }
  get name() { return this.char.name; }

  get invulnerable() {
    return this.invincible > 0
      || (this.action === 'dodge' && this.dodgeTimer <= this.dodgeIframes)
      || this.respawnGlow > 0;
  }

  isCountering() {
    if (this.action !== 'attack' || !this.move || !this.move.counter) return false;
    return this.attackFrame >= this.move.startup && this.attackFrame < this.move.startup + this.move.active;
  }

  hurtbox() {
    const h = this.char.hurt;
    const crouch = this.crouching && this.grounded ? 0.74 : 1;
    const height = h.h * crouch;
    return { x: this.x - h.w / 2, y: this.y - height, w: h.w, h: height };
  }

  hitboxWorld() {
    if (!this.move || !this.move.hitbox) return null;
    const hb = this.move.hitbox;
    return { x: this.x + hb.x * this.facing, y: this.y + hb.y, r: hb.r };
  }

  // -------------------------------------------------------------------------
  update(input, game) {
    this.time++;
    this.animTime++;
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.counterFlash > 0) this.counterFlash--;
    if (this.invincible > 0) this.invincible--;
    if (this.respawnGlow > 0) this.respawnGlow--;
    if (this.landSquash > 0) this.landSquash--;
    if (this.hitstop > 0) { this.hitstop--; return; }
    if (this.eliminated) return;

    if (this.koTimer > 0) {
      this.koTimer--;
      if (this.koTimer === 0) this.respawn(game);
      return;
    }

    if (this.floatTimer > 0) this.floatTimer--;

    // Shield regeneration
    if (this.action !== 'shield' && this.shieldstun <= 0) {
      this.shieldHP = Math.min(100, this.shieldHP + (this.shieldbroken > 0 ? 0.05 : 0.22));
    }
    if (this.shieldstun > 0) this.shieldstun--;

    this.wasGrounded = this.grounded;

    if (this.action === 'shieldbreak') {
      this.shieldTimer--;
      this.crouching = false;
      this.applyPhysics(input, game);
      this.postPhysics(game);
      if (this.shieldTimer <= 0) {
        this.action = null;
        this.shieldbroken = 0;
        this.shieldHP = Math.max(30, this.shieldHP);
      }
      return;
    }

    if (this.hitstun > 0) {
      this.hitstun--;
      this.crouching = false;
      if (this.hitstun === 0) this.tumble = false;
      // small drift while in hitstun
      if (!this.grounded) {
        const dir = (has(input.held, 'right') ? 1 : 0) - (has(input.held, 'left') ? 1 : 0);
        this.vx += dir * 0.045;
      }
      this.applyPhysics(input, game);
      this.postPhysics(game);
      return;
    }

    if (this.action === 'attack') {
      this.crouching = false;
      this.updateAttack(input, game);
      this.applyPhysics(input, game);
      this.postPhysics(game);
      return;
    }

    if (this.action === 'dodge') {
      this.updateDodge(game);
      this.applyPhysics(input, game);
      this.postPhysics(game);
      return;
    }

    if (this.action === 'shield') {
      this.updateShield(input, game);
      this.crouching = false;
      this.applyPhysics(input, game);
      this.postPhysics(game);
      return;
    }

    this.handleFree(input, game);
    this.applyPhysics(input, game);
    this.postPhysics(game);
  }

  // -------------------------------------------------------------------------
  handleFree(input, game) {
    const p = this.power;
    const held = input.held;
    const pressed = input.pressed;
    const dirX = (has(held, 'right') ? 1 : 0) - (has(held, 'left') ? 1 : 0);
    const down = has(held, 'down');
    const up = has(held, 'up');

    this.crouching = this.grounded && down;

    if (this.helpless) {
      if (this.grounded) this.helpless = false;
      else {
        if (dirX) {
          this.vx += dirX * 0.16;
          this.vx = Math.max(-p.airSpeed * 0.8, Math.min(p.airSpeed * 0.8, this.vx));
        }
        return;
      }
    }

    // Shield / dodge
    if (has(pressed, 'dodge')) {
      this.startDodge(input, game);
      return;
    }
    if (has(pressed, 'shield')) {
      if (this.grounded) this.startShield(game);
      else this.startDodge(input, game, true);
      return;
    }

    // Attacks and specials come before jumping so Up+Attack does an up smash.
    if (has(pressed, 'attack')) {
      this.startAttack(input, game);
      return;
    }
    if (has(pressed, 'special')) {
      this.startSpecial(input, game);
      return;
    }

    if (has(pressed, 'jump') && this.jumpsLeft > 0 && !this.crouching) {
      this.jump(game);
      return;
    }

    // Movement
    if (this.grounded) {
      if (this.crouching) {
        this.vx *= 0.72;
      } else {
        const target = dirX * p.runSpeed;
        if (dirX) {
          this.facing = dirX;
          this.vx += (target - this.vx) * 0.34;
          this.runPhase += Math.abs(this.vx) * 0.09;
          this.dustTimer++;
          if (Math.abs(this.vx) > 4 && this.dustTimer % 9 === 0) {
            game.dust(this.x - this.facing * 10, this.y, this.facing, this.color);
          }
        } else {
          this.vx *= p.traction;
          if (Math.abs(this.vx) < 0.15) this.vx = 0;
        }
      }
    } else {
      if (dirX) {
        this.vx += dirX * p.airAccel;
        this.vx = Math.max(-p.airSpeed, Math.min(p.airSpeed, this.vx));
        this.facing = dirX;
      } else {
        this.vx *= 0.985;
      }
      // fast fall
      if (has(pressed, 'down') && this.vy > -3 && !this.fastfall) {
        this.vy = Math.max(this.vy, 12.5);
        this.fastfall = true;
        game.dust(this.x, this.y - 10, 0, '#ffffff', 3);
      }
    }
  }

  jump(game) {
    const first = this.grounded;
    const p = this.power;
    this.grounded = false;
    this.y -= 2;
    this.vy = -(first ? p.jump : p.doubleJump);
    this.jumpsLeft--;
    this.cutJump = false;
    this.crouching = false;
    this.fastfall = false;
    this.landSquash = 0;
    this.dodgeTimer = 0;
    audio.jump();
    if (!first) {
      audio.doubleJump();
      game.ring(this.x, this.y - 22, this.color, 26);
      game.burst(this.x, this.y - 14, this.color, 6, 3);
    } else {
      game.dust(this.x, this.y, 0, '#ffffff', 3);
    }
  }

  startShield(game) {
    this.action = 'shield';
    this.shieldTimer = 0;
    this.vx *= 0.4;
    game.ring(this.x, this.y - 40, '#45e3ff', 22);
    audio.click();
  }

  updateShield(input, game) {
    this.shieldTimer++;
    if (this.shieldstun > 0) return;
    this.shieldHP -= 0.36;
    if (this.shieldHP <= 0) { this.breakShield(game); return; }
    if (!has(input.held, 'shield')) {
      this.action = null;
      this.shieldTimer = 0;
      this.shieldstun = 4;
    }
  }

  breakShield(game) {
    this.shieldHP = 0;
    this.action = 'shieldbreak';
    this.shieldTimer = 95;
    this.shieldbroken = 60;
    this.vx = 0;
    game.burst(this.x, this.y - 45, '#8fe9ff', 18, 7);
    game.ring(this.x, this.y - 42, '#8fe9ff', 60);
    game.announce('SHIELD BREAK', this.tag, '#8fe9ff', 40);
    audio.shieldBreak();
    game.shake = Math.max(game.shake, 9);
  }

  startDodge(input, game, forceAir = false) {
    if (!this.grounded && this.airDodgeUsed) return;
    const dirX = (has(input.held, 'right') ? 1 : 0) - (has(input.held, 'left') ? 1 : 0);
    const dirY = (has(input.held, 'down') ? 1 : 0) - (has(input.held, 'up') ? 1 : 0);
    this.action = 'dodge';
    this.dodgeTimer = 0;
    this.dodgeDuration = this.grounded ? 19 : 24;
    this.dodgeIframes = this.grounded ? 12 : 14;
    this.charging = false;
    this.move = null;
    if (this.grounded) {
      if (dirX) {
        this.facing = dirX;
        this.vx = dirX * 7.2;
      } else {
        this.vx = 0;
      }
      this.vy = 0;
      game.dust(this.x, this.y, -this.facing, '#d9d4ee', 4);
    } else {
      this.airDodgeUsed = true;
      this.vx = dirX * 7.0;
      this.vy = dirY * 6.4;
      if (!dirX && !dirY) this.vy = -1.5;
      this.fastfall = false;
      game.ring(this.x, this.y - 40, '#ffffff', 28);
    }
    audio.dodge();
  }

  updateDodge(game) {
    this.dodgeTimer++;
    if (this.dodgeTimer <= this.dodgeIframes && this.dodgeTimer % 3 === 0) {
      game.trailGhost(this);
    }
    if (this.grounded) this.vx *= 0.9;
    if (this.dodgeTimer >= this.dodgeDuration) {
      this.action = null;
      this.dodgeTimer = 0;
      if (this.grounded) this.vx *= 0.3;
    }
  }

  startAttack(input, game) {
    if (this.helpless) return;
    const held = input.held;
    const dirX = (has(held, 'right') ? 1 : 0) - (has(held, 'left') ? 1 : 0);
    const up = has(held, 'up');
    const down = has(held, 'down');
    let key;
    if (!this.grounded) {
      if (up) key = 'uair';
      else if (down) key = 'dair';
      else if (dirX) key = 'fair';
      else key = 'nair';
    } else {
      if (up) key = 'up';
      else if (down) key = 'down';
      else if (dirX) key = 'side';
      else if (Math.abs(this.vx) > this.power.runSpeed * 0.82) key = 'dash';
      else key = 'jab';
    }
    if (dirX) this.facing = dirX;
    this.beginMove(key, input);
    audio.whiff();
    if (this.grounded) game.dust(this.x, this.y, this.facing, '#ffffff', 2);
  }

  startSpecial(input, game) {
    if (this.helpless) return;
    const held = input.held;
    const dirX = (has(held, 'right') ? 1 : 0) - (has(held, 'left') ? 1 : 0);
    const up = has(held, 'up');
    const down = has(held, 'down');
    let key;
    if (up) key = 'uspecial';
    else if (down) key = 'dspecial';
    else if (dirX) key = 'sspecial';
    else key = 'nspecial';
    if (dirX) this.facing = dirX;
    this.beginMove(key, input);
    if (key === 'dspecial') audio.counter();
  }

  beginMove(key, input) {
    const move = this.char.moves[key];
    if (!move) return;
    this.action = 'attack';
    this.moveKey = key;
    this.move = move;
    this.attackFrame = 0;
    this.charge = 0;
    this.charging = Boolean(move.chargeable && has(input.held, 'attack'));
    this.hitTargets = new Set();
    this.spawned = new Set();
    this.crouching = false;
    this.armor = Boolean(move.armor);
    this.tumble = false;
    if (move.lunge && !this.grounded) this.vx *= 0.4;
  }

  updateAttack(input, game) {
    const m = this.move;
    if (!m) { this.action = null; return; }

    if (this.charging) {
      if (this.charge < MAX_CHARGE) {
        this.charge++;
        this.chargeFx++;
        if (this.charge % 8 === 0) audio.charge(this.charge);
        if (this.charge % 2 === 0) game.chargeSpark(this);
      }
      if (!has(input.held, 'attack')) this.charging = false;
      else return; // hold the pose
    }

    this.attackFrame++;
    const f = this.attackFrame;

    if (m.recover && f === m.recover.frame) {
      this.vy = m.recover.vy;
      this.vx = m.recover.vx * this.facing;
      this.grounded = false;
      this.jumpsLeft = Math.min(this.jumpsLeft, 1);
      this.floatTimer = m.float || 0;
      this.fastfall = false;
      game.burst(this.x - this.facing * 6, this.y - 8, this.char.palette.glow, 10, 6);
      game.ring(this.x, this.y - 10, this.char.palette.glow, 40);
      audio.rise();
    }
    if (m.spawn) {
      for (const s of m.spawn) {
        if (s.frame === f && !this.spawned.has(s.frame)) {
          this.spawned.add(s.frame);
          game.spawnProjectile(this, s.projectile);
          audio.projectile(s.projectile.kind);
          game.burst(this.x + this.facing * 30, this.y - 62, this.char.palette.glow, 6, 4);
        }
      }
    }
    if (m.lunge && f === m.startup) {
      this.vx = m.lunge * this.facing;
      game.dust(this.x, this.y, -this.facing, '#ffffff', 5);
      if (m.trail) game.trailGhost(this);
    }

    // active window
    if (f >= m.startup && f < m.startup + m.active) {
      if (m.hitbox && m.damage > 0 && !m.counter) this.checkHits(game);
      if (m.trail && f % 2 === 0) game.trailGhost(this);
    }

    if (f >= m.startup + m.active + m.recovery) {
      this.endMove();
    }
  }

  endMove() {
    const m = this.move;
    this.action = null;
    this.move = null;
    this.moveKey = null;
    this.attackFrame = 0;
    this.charge = 0;
    this.charging = false;
    this.armor = false;
    if (m && m.helpless) this.helpless = true;
  }

  checkHits(game) {
    const hb = this.hitboxWorld();
    if (!hb) return;
    for (const other of game.fighters) {
      if (other === this || !other.alive || other.koTimer > 0) continue;
      if (this.hitTargets.has(other.slot)) continue;
      const box = other.hurtbox();
      if (circleRect(hb.x, hb.y, hb.r, box)) {
        this.hitTargets.add(other.slot);
        this.landHit(other, game);
      }
    }
  }

  landHit(victim, game) {
    const m = this.move;
    if (!m) return;
    const chargeMul = 1 + (this.charge / MAX_CHARGE) * 0.55;
    const dmg = m.damage * chargeMul;
    const res = victim.takeHit(m, this, chargeMul, game, { dir: this.facing });

    if (res === 'countered') {
      this.stats.dealt += 0;
      return;
    }
    if (res === 'hit' || res === 'shield' || res === 'armor') {
      this.stats.dealt += res === 'hit' ? dmg : res === 'armor' ? dmg * 0.55 : 0;
      if (res !== 'armor') this.charge = 0;
      if (res === 'hit') {
        game.hitstop = Math.max(game.hitstop, m.hitstop || 3);
        game.onHit(this, victim, dmg);
      } else if (res === 'shield') {
        game.hitstop = Math.max(game.hitstop, 2);
        game.onShieldHit(this, victim);
      }
    }
  }

  // -------------------------------------------------------------------------
  takeHit(move, attacker, chargeMul, game, opts = {}) {
    if (!this.alive || this.koTimer > 0) return 'whiff';
    if (this.invulnerable) {
      game.whiffSpark(this.x, this.y - 45);
      return 'whiff';
    }
    if (this.isCountering()) {
      this.counterSuccess(attacker, game);
      return 'countered';
    }

    const armorBlocks = this.armor && this.action === 'attack' && this.move;
    if (armorBlocks) {
      const dmg = move.damage * chargeMul * 0.55;
      this.damage = Math.min(999, this.damage + dmg);
      this.stats.taken += dmg;
      this.lastHitBy = attacker ? attacker.slot : null;
      this.hitFlash = 5;
      this.vx += Math.sign(opts.dir || 1) * 0.5;
      game.burst(this.x, this.y - 48, this.char.palette.glow, 7, 4);
      game.popup(this.x, this.y - 86, 'ARMOR', this.char.palette.glow, 0.72);
      audio.hit(dmg * 0.5, false);
      return 'armor';
    }

    const shieldBlocks = this.action === 'shield' && this.shieldHP > 0 && this.grounded;
    if (shieldBlocks) {
      const dmg = move.damage * chargeMul;
      this.shieldHP -= dmg * 1.45 + 3.5;
      this.shieldstun = Math.max(this.shieldstun, 5 + dmg * 0.45);
      this.vx += Math.sign(opts.dir || 1) * (1.1 + dmg * 0.05);
      if (this.shieldHP <= 0) this.breakShield(game);
      audio.shieldHit();
      return 'shield';
    }

    const dir = opts.dir || (attacker ? attacker.facing : 1);
    const dmg = Math.max(0.5, move.damage * chargeMul);
    this.damage = Math.min(999, this.damage + dmg);
    this.stats.taken += dmg;
    this.hitFlash = 9;
    this.counterFlash = 0;
    this.action = null;
    this.move = null;
    this.moveKey = null;
    this.attackFrame = 0;
    this.charging = false;
    this.charge = 0;
    this.armor = false;
    this.shieldstun = 0;
    this.crouching = false;
    this.lastHitBy = attacker ? attacker.slot : null;

    const weight = this.power.weight || 1;
    let power = (move.baseKB + move.growth * (this.damage / 100));
    power *= 1 / Math.pow(weight, 0.8);
    power *= 1 + (chargeMul - 1) * 0.9;
    power = Math.min(190, power);

    const speed = Math.min(31, power * 0.165);
    const rad = (move.angle || 35) * DEG;
    this.vx = Math.cos(rad) * speed * dir;
    this.vy = -Math.sin(rad) * speed;
    if (this.vy > -1.2 && Math.abs(this.vx) < 3) this.vy = -2.2;
    this.hitstun = Math.round(Math.max(10, Math.min(110, 6 + power * 0.7)));
    this.tumble = power > 68;
    this.grounded = false;
    this.fastfall = false;
    this.y -= 1.5;
    this.jumpsLeft = Math.min(this.jumpsLeft, 1);

    if (this.armorFlag) this.armorFlag = false;
    game.burst(this.x, this.y - 45, '#fff4d8', Math.min(18, 7 + dmg), 6);
    game.ring(this.x, this.y - 45, '#ffffff', 34);
    game.shake = Math.max(game.shake, Math.min(14, 2 + dmg * 0.45));
    if (dmg >= 15) game.screenFlash = Math.max(game.screenFlash, 0.28);
    audio.hit(dmg, dmg > 13);
    return 'hit';
  }

  counterSuccess(attacker, game) {
    this.counterFlash = 32;
    this.invincible = Math.max(this.invincible, 30);
    this.hitstop = Math.max(this.hitstop, 8);
    game.hitstop = Math.max(game.hitstop, 8);
    game.onCounter(this, attacker);
    audio.counter();
    if (attacker && attacker.alive) {
      const cm = {
        damage: this.move.damage + Math.min(8, attacker.damage * 0.05),
        baseKB: this.move.baseKB,
        growth: this.move.growth,
        angle: this.move.angle,
      };
      attacker.takeHit(cm, this, 1, game, { dir: this.facing });
      this.stats.dealt += cm.damage;
      game.announce('COUNTER', this.tag, this.char.palette.glow, 34);
    }
    // Skip the remainder of the counter window
    this.attackFrame = this.move ? this.move.startup + this.move.active : 0;
  }

  // -------------------------------------------------------------------------
  applyPhysics(input, game) {
    const p = this.power;
    const dirX = (has(input.held, 'right') ? 1 : 0) - (has(input.held, 'left') ? 1 : 0);

    if (this.grounded) {
      this.vy = 0;
      if (this.action === 'attack' && !this.charging) this.vx *= 0.93;
      if (this.action === 'attack' && this.charging) this.vx *= 0.8;
      if (this.action === 'shield') this.vx *= 0.75;
      if (this.action === 'shieldbreak') this.vx *= 0.9;
      if (this.action === null && !this.crouching && !has(input.held, 'left') && !has(input.held, 'right')) {
        this.vx *= p.traction;
      }
      if (this.hitstun > 0) this.vx *= 0.9;
    } else {
      let grav = GRAVITY * p.gravity;
      if (this.floatTimer > 0) grav *= 0.38;
      if (this.fastfall) grav *= 1.25;
      if (this.action === 'attack') {
        if (dirX) {
          this.vx += dirX * 0.1;
          this.vx = Math.max(-p.airSpeed * 0.7, Math.min(p.airSpeed * 0.7, this.vx));
        }
      }
      if (this.action === 'shield') this.vx *= 0.96;
      this.vy += grav;
      const maxFall = this.fastfall ? MAX_FALL + 4 : MAX_FALL * p.gravity;
      if (this.vy > maxFall) this.vy = maxFall;

      if (this.action === null && !this.helpless && dirX) {
        this.facing = dirX;
      }
      // jump-cut on release
      if (this.vy < -4 && !has(input.held, 'jump') && !this.cutJump && this.action === null) {
        this.vy *= 0.58;
        this.cutJump = true;
      }
    }

    const prevY = this.y;
    this.x += this.vx;
    this.y += this.vy;

    this.collideStage(game, prevY);
    this.keepInBoundsSoftly(game);

    if (Math.abs(this.vx) > 8 || Math.abs(this.vy) > 10) {
      this.trail.push({ x: this.x, y: this.y, facing: this.facing, alpha: 0.42, color: this.char.palette.glow });
      if (this.trail.length > 7) this.trail.shift();
    }
    for (const t of this.trail) t.alpha *= 0.9;
    this.trail = this.trail.filter((t) => t.alpha > 0.04);
    if (this.action === 'dodge' && this.dodgeTimer <= this.dodgeIframes && this.dodgeTimer % 2 === 0) {
      this.trail.push({ x: this.x, y: this.y, facing: this.facing, alpha: 0.35, color: '#ffffff' });
    }
  }

  collideStage(game, prevY) {
    const platforms = [...game.stage.platforms].sort((a, b) => a.y - b.y);
    const halfPad = this.char.hurt.w * 0.32;
    let landed = false;

    if (this.vy >= 0) {
      for (const p of platforms) {
        const half = p.w / 2;
        if (this.x < p.x - half + halfPad * 0.3 || this.x > p.x + half - halfPad * 0.3) continue;
        if (prevY <= p.y + 3 && this.y >= p.y) {
          const impact = this.vy;
          this.y = p.y;
          this.vy = 0;
          this.grounded = true;
          landed = true;
          if (!this.wasGrounded) this.land(impact, game);
          break;
        }
      }
    }

    if (!landed) {
      let support = null;
      for (const p of platforms) {
        const half = p.w / 2;
        if (this.x >= p.x - half && this.x <= p.x + half && Math.abs(this.y - p.y) < 1.2) { support = p; break; }
      }
      if (support && this.vy >= 0) {
        this.y = support.y;
        this.vy = 0;
        if (!this.grounded && !this.wasGrounded) this.land(0, game);
        this.grounded = true;
      } else {
        if (this.grounded) {
          this.grounded = false;
          this.jumpsLeft = Math.min(this.jumpsLeft, 1);
        }
      }
    }
  }

  land(impact, game) {
    const hard = impact > 9;
    this.landSquash = hard ? 8 : 4;
    this.jumpsLeft = 2;
    this.airDodgeUsed = false;
    this.helpless = false;
    this.fastfall = false;
    this.cutJump = false;
    this.floatTimer = 0;
    this.airDodgeUsed = false;
    this.landSquash = hard ? 9 : 5;
    game.dust(this.x, this.y, 0, '#e9e4ff', hard ? 8 : 4);
    if (impact > 7) {
      if (this.hitstun > 0 && impact > 10) {
        this.vy = -impact * 0.42;
        this.y = this.y - 1.5;
        this.grounded = false;
        game.shake = Math.max(game.shake, 4);
        game.dust(this.x, this.y, 0, '#ffffff', 10);
        audio.land(1.4);
      } else {
        audio.land(Math.min(2, impact / 9));
      }
    }
  }

  keepInBoundsSoftly(game) {
    if (this.x < BLAST.left - 80) this.x = BLAST.left - 80;
    if (this.x > BLAST.right + 80) this.x = BLAST.right + 80;
  }

  postPhysics(game) {
    this.checkKO(game);
    this.checkHitsAfterPhysics?.();
  }

  checkKO(game) {
    if (!this.alive || this.koTimer > 0 || game.phase !== 'fight') return;
    const out = this.x < BLAST.left || this.x > BLAST.right || this.y > BLAST.bottom || this.y < BLAST.top;
    if (!out) return;
    this.stocks--;
    this.stats.falls++;
    if (this.stocks < 0) this.stocks = 0;
    this.koTimer = 78;
    this.action = 'ko';
    this.move = null;
    this.hitstun = 0;
    this.vx = 0;
    this.vy = 0;
    this.trail = [];
    const killer = this.lastHitBy !== null
      ? game.fighters.find((f) => f.slot === this.lastHitBy) || null
      : null;
    game.onKO(this, killer);
    if (this.stocks <= 0) this.eliminated = true;
  }

  respawn(game) {
    if (this.stocks <= 0) { this.eliminated = true; return; }
    this.x = Math.max(-520, Math.min(520, this.spawn.x));
    this.y = -260;
    this.vx = 0;
    this.vy = 0;
    this.damage = 0;
    this.action = null;
    this.move = null;
    this.attackFrame = 0;
    this.hitstun = 0;
    this.hitstop = 0;
    this.charging = false;
    this.helpless = false;
    this.grounded = false;
    this.jumpsLeft = 2;
    this.facing = this.x <= 0 ? 1 : -1;
    this.lastHitBy = null;
    this.invincible = 150;
    this.respawnGlow = 150;
    this.shieldHP = 100;
    this.airDodgeUsed = false;
    this.hitFlash = 0;
    this.koTimer = 0;
    game.respawnFx(this);
    audio.jump();
  }

  /** Called on match start/restart. */
  prepareMatch(stage, stocks) {
    this.reset(stage, stocks);
  }

  /** True if this fighter is hidden because they are exploding off-screen. */
  get invisible() {
    return this.koTimer > 0 || this.eliminated;
  }
}

export function circleRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

export { ACTIONS };
