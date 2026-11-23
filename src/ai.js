// ---------------------------------------------------------------------------
// CPU brains — readable opponents that space, defend, and recover.
// ---------------------------------------------------------------------------
import { DIFFICULTIES } from './data.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

export class AIBrain {
  constructor(fighter, difficulty = 2) {
    this.f = fighter;
    this.diff = DIFFICULTIES.find((d) => d.id === difficulty) || DIFFICULTIES[1];
    this.react = 0;
    this.attackCd = 0;
    this.specialCd = 30;
    this.jumpCd = 0;
    this.defendCd = 0;
    this.holdAttack = 0;
    this.holdShield = 0;
    this.strafe = 1;
    this.strafeTimer = 0;
    this.wander = 0;
    this.recoverJumped = false;
    this.recoverSpecial = false;
    this.targetSlot = null;
  }

  reset() {
    this.react = 0;
    this.attackCd = 0;
    this.specialCd = 20;
    this.jumpCd = 0;
    this.defendCd = 0;
    this.holdAttack = 0;
    this.holdShield = 0;
    this.recoverJumped = false;
    this.recoverSpecial = false;
    this.targetSlot = null;
  }

  nearestTarget(game) {
    let best = null;
    let bestD = Infinity;
    for (const other of game.fighters) {
      if (other === this.f || !other.alive || other.koTimer > 0) continue;
      const d = Math.hypot(other.x - this.f.x, other.y - this.f.y);
      if (d < bestD) { bestD = d; best = other; }
    }
    this.targetSlot = best ? best.slot : null;
    return best;
  }

  update(game) {
    const input = { held: new Set(), pressed: new Set() };
    const f = this.f;
    if (!f || f.eliminated || f.koTimer > 0) return input;
    if (game.phase !== 'fight' || game.freezeInput) return input;
    if (this.attackCd > 0) this.attackCd--;
    if (this.specialCd > 0) this.specialCd--;
    if (this.jumpCd > 0) this.jumpCd--;
    if (this.defendCd > 0) this.defendCd--;
    if (this.react > 0) this.react--;
    if (this.wander > 0) this.wander--;
    if (this.strafeTimer-- <= 0) {
      this.strafeTimer = Math.round(rnd(18, 55));
      this.strafe = chance(0.5) ? 1 : -1;
    }

    // Already committed to an action — do not stack inputs.
    if (f.action === 'attack' || f.action === 'dodge' || f.action === 'shieldbreak') {
      if (f.action === 'attack' && f.charging) {
        // let a charged smash rip once it is nasty enough
        if (f.charge > 18 + Math.round(Math.random() * 18)) return input;
        input.held.add('attack');
        return input;
      }
      return input;
    }
    if (f.action === 'shield') {
      if (this.holdShield > 0) {
        this.holdShield--;
        input.held.add('shield');
      }
      return input;
    }
    if (f.hitstun > 0) {
      return input;
    }

    if (this.holdAttack > 0) {
      this.holdAttack--;
      input.held.add('attack');
      if (this.attackDir) input.held.add(this.attackDir);
      return input;
    }

    const main = game.stage.platforms[0];
    const half = main.w / 2;
    const edgeMargin = 54;
    const offstage = f.x < main.x - half - 8 || f.x > main.x + half + 8 || f.y > 30;

    // ---- recovery ---------------------------------------------------------
    if (offstage && !f.grounded) {
      return this.recover(input, game, main, half);
    }
    this.recoverJumped = false;
    this.recoverSpecial = false;

    const target = this.nearestTarget(game);
    if (!target) return input;

    const dx = target.x - f.x;
    const dy = target.y - f.y;
    const dist = Math.hypot(dx, dy);
    const toward = dx >= 0 ? 'right' : 'left';
    const away = dx >= 0 ? 'left' : 'right';
    const outEdge = f.x < main.x - half + edgeMargin ? -1 : f.x > main.x + half - edgeMargin ? 1 : 0;
    const targetOffstage = target.x < main.x - half - 10 || target.x > main.x + half + 10 || target.y > 40;

    // ---- defense ----------------------------------------------------------
    if (this.defendCd <= 0 && dist < 165 && this.diff.defense > 0) {
      const targetThreat = (target.action === 'attack' || target.action === 'dodge') && target.facing === Math.sign(f.x - target.x);
      const projectileNear = game.projectiles.some((p) => p.owner !== f.slot
        && Math.hypot(p.x - f.x, p.y - (f.y - 40)) < 110
        && Math.sign(p.vx) === Math.sign(f.x - p.x));
      if ((targetThreat || projectileNear) && chance(this.diff.defense * 0.55)) {
        if (chance(0.55) && f.grounded && f.shieldHP > 35) {
          this.holdShield = Math.round(rnd(9, 19));
          this.defendCd = Math.round(rnd(38, 80));
          input.pressed.add('shield');
          input.held.add('shield');
          return input;
        }
        if (chance(0.6)) {
          this.defendCd = Math.round(rnd(50, 100));
          if (chance(0.6) && f.grounded) {
            input.pressed.add('dodge');
            input.held.add(away);
            return input;
          }
          if (!f.grounded && !f.airDodgeUsed) {
            input.pressed.add('dodge');
            input.held.add(away);
            return input;
          }
        }
      }
    }

    // ---- edgeguard --------------------------------------------------------
    if (targetOffstage && f.grounded) {
      const holdX = target.x > f.x ? 'right' : 'left';
      if (Math.abs(f.x - target.x) > 120 && outEdge === 0) input.held.add(holdX);
      if (!outEdge && this.specialCd <= 0 && Math.abs(target.x - f.x) < 460 && chance(0.5)) {
        this.specialCd = Math.round(rnd(55, 95));
        input.pressed.add('special');
        return input;
      }
      if (Math.abs(f.x - target.x) < 150 && chance(this.diff.aggression * 0.35)) {
        input.pressed.add('jump');
        this.jumpCd = 30;
        return input;
      }
      if (outEdge !== 0) input.held.add(outEdge > 0 ? 'left' : 'right');
      return input;
    }

    // ---- movement ---------------------------------------------------------
    let moveDir = 0;
    if (Math.abs(dx) > 66) moveDir = Math.sign(dx);
    else if (this.wander > 0) moveDir = this.strafe;
    else if (f.damage > 90 && chance(0.02)) this.wander = 22;

    // Don't sprint off the ledge unless chasing an offstage target.
    if (f.grounded && outEdge !== 0 && Math.sign(moveDir) === outEdge) moveDir = -outEdge;
    if (moveDir !== 0) input.held.add(moveDir > 0 ? 'right' : 'left');

    // Jump toward elevated targets / platforms.
    if (f.grounded && dy < -70 && this.jumpCd <= 0 && dist < 380 && chance(this.diff.aggression * 0.45)) {
      input.pressed.add('jump');
      this.jumpCd = Math.round(rnd(28, 55));
      this.recoverJumped = false;
      return input;
    }

    // ---- projectiles ------------------------------------------------------
    if (f.grounded && this.specialCd <= 0 && dist > 190 && Math.abs(dy) < 120
      && chance(this.diff.aggression * 0.55)) {
      this.specialCd = Math.round(rnd(70, 125));
      input.pressed.add('special');
      return input;
    }

    // ---- attacks ----------------------------------------------------------
    if (this.react > 0) return input;

    const facing = Math.sign(dx) || 1;
    const canAttack = this.attackCd <= 0;
    if (!canAttack) return input;

    if (!f.grounded) {
      if (dist < 128) {
        this.attackCd = Math.round(rnd(14, 30));
        input.pressed.add('attack');
        if (target.y < f.y - 55) input.held.add('up');
        else if (target.y > f.y + 55) input.held.add('down');
        else input.held.add(toward);
        this.react = this.diff.reaction;
        return input;
      }
      return input;
    }

    // Grounded attack pick
    if (Math.abs(dy) > 90 && Math.abs(dx) < 110) {
      // target above/below on a platform
      this.attackCd = Math.round(rnd(16, 30));
      input.pressed.add('attack');
      input.held.add(dy < 0 ? 'up' : 'down');
      this.react = this.diff.reaction;
      return input;
    }

    if (dist < 168) {
      const wantCharge = f.damage < 80 && dist < 125 && chance(this.diff.aggression * 0.24);
      this.attackCd = Math.round(rnd(13, 26));
      this.react = this.diff.reaction;
      input.pressed.add('attack');
      if (dist > 74) {
        input.held.add(toward);
      } else if (chance(0.22)) {
        input.held.add('up');
      } else if (chance(0.12)) {
        input.held.add('down');
      }
      if (wantCharge && (input.held.has(toward) || input.held.has('up') || input.held.has('down'))) {
        this.holdAttack = Math.round(rnd(7, 20));
        this.attackDir = input.held.has(toward) ? toward : input.held.has('up') ? 'up' : 'down';
        input.held.add('attack');
      }
      return input;
    }

    // Close the gap with a dash attack sometimes.
    if (dist < 260 && chance(this.diff.aggression * 0.25)) {
      this.attackCd = Math.round(rnd(20, 38));
      this.react = this.diff.reaction;
      input.pressed.add('attack');
      input.held.add(toward);
      return input;
    }

    if (facing !== 0 && outEdge === Math.sign(dx) && f.grounded) {
      input.held.add(toward);
    }
    return input;
  }

  recover(input, game, main, half) {
    const f = this.f;
    const cx = main.x;
    const towardC = cx >= f.x ? 'right' : 'left';
    const far = Math.abs(f.x - cx) > half - 30;
    const skill = this.diff.recovery;

    if (far || f.x < cx - half || f.x > cx + half) input.held.add(towardC);
    else if (f.x < cx - half + 40) input.held.add('right');
    else if (f.x > cx + half - 40) input.held.add('left');

    // Jump back toward the stage.
    if (!this.recoverJumped && f.jumpsLeft > 0 && f.vy > -2 && f.y > -120 && chance(skill)) {
      this.recoverJumped = true;
      input.pressed.add('jump');
      return input;
    }

    // Up-special when below the stage lip.
    const deep = f.y > 35 || far;
    if (!this.recoverSpecial && !f.helpless && deep
      && (f.jumpsLeft <= 1 || f.y > 40) && chance(skill)) {
      this.recoverSpecial = true;
      input.pressed.add('special');
      input.held.add('up');
      return input;
    }

    // Fall back on side special if the up special is spent.
    if (this.recoverSpecial && !this.recoverJumped && f.helpless && chance(0.1)) {
      input.held.add(towardC);
    }
    return input;
  }
}
