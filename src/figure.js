// ---------------------------------------------------------------------------
// Figure — procedural fighter art, poses, faces and accessories.
// ---------------------------------------------------------------------------
import { CHAR_MAP } from './data.js';
import {
  TAU, clamp, hexA, mix, shade, capsule, limb2, poly, glowCircle,
  roundRect, starPath,
} from './draw-utils.js';

const OUTLINE = '#1a1122';

export function buildPose(f, time) {
  const t = (f.animTime ?? time) + (f.slot || 0) * 13;
  const grounded = f.grounded !== false;
  const speed = Math.abs(f.vx || 0);
  const bob = grounded ? Math.sin(t * 0.06) * 1.5 : 0;

  const p = {
    bob, lean: 0, spin: 0, headTilt: 0,
    hipY: -40 + bob, shoulderY: -70 + bob, headY: -88 + bob, headX: 1,
    headR: 15,
    frontHand: { x: 20, y: -49 + bob }, backHand: { x: -17, y: -50 + bob },
    frontFoot: { x: 13, y: 0 }, backFoot: { x: -14, y: 0 },
    armBendF: 4, armBendB: -4, legBendF: 2, legBendB: -2,
    glow: 0, shield: false, scarf: 0,
  };

  // --- locomotion ----------------------------------------------------------
  if (grounded && !f.action && speed > 1.4) {
    const ph = f.runPhase || t * 0.15;
    const swing = Math.sin(ph);
    p.frontFoot = { x: 10 + swing * 18, y: -Math.max(0, swing) * 9 };
    p.backFoot = { x: 10 - swing * 18, y: -Math.max(0, -swing) * 9 };
    p.frontHand = { x: 18 - swing * 11, y: -52 };
    p.backHand = { x: -16 + swing * 11, y: -52 };
    p.lean = 0.055 + Math.min(0.06, speed * 0.008);
    p.hipY = -41 + Math.abs(swing) * 2;
    p.shoulderY = -70 + Math.abs(swing) * 2;
    p.headY = -88 + Math.abs(swing) * 2;
  } else if (grounded && !f.action && !f.crouching) {
    p.frontHand.x += Math.sin(t * 0.06) * 1.4;
    p.backHand.x -= Math.sin(t * 0.06) * 1.4;
  }

  if (f.crouching && grounded) {
    p.hipY += 12;
    p.shoulderY += 11;
    p.headY += 10;
    p.frontFoot = { x: 17, y: 0 };
    p.backFoot = { x: -17, y: 0 };
    p.frontHand = { x: 16, y: -40 };
    p.backHand = { x: -13, y: -42 };
  }

  if (!grounded) {
    const rising = (f.vy || 0) < -2;
    p.legBendF = rising ? 12 : 4;
    p.legBendB = rising ? -10 : -4;
    p.frontFoot = { x: rising ? 15 : 9, y: rising ? -12 : 2 };
    p.backFoot = { x: rising ? -7 : -12, y: rising ? -4 : 0 };
    p.frontHand = { x: rising ? 25 : 30, y: rising ? -78 : -62 };
    p.backHand = { x: rising ? -24 : -30, y: rising ? -70 : -58 };
    p.lean = rising ? 0.04 : -0.03;
    if (f.fastfall) {
      p.frontHand = { x: 12, y: -98 };
      p.backHand = { x: -12, y: -98 };
      p.frontFoot = { x: 8, y: 4 };
      p.backFoot = { x: -8, y: 2 };
    }
  }

  // --- shield / break ------------------------------------------------------
  if (f.action === 'shield') {
    p.hipY += 9; p.shoulderY += 8; p.headY += 7;
    p.frontHand = { x: 11, y: -58 };
    p.backHand = { x: 6, y: -62 };
    p.frontFoot = { x: 16, y: 0 };
    p.backFoot = { x: -16, y: 0 };
    p.shield = true;
    p.lean = -0.05;
  }
  if (f.action === 'shieldbreak') {
    p.lean = Math.sin(t * 0.28) * 0.16;
    p.headTilt = Math.sin(t * 0.22) * 0.24;
    p.frontHand = { x: 20, y: -36 };
    p.backHand = { x: -20, y: -38 };
    p.frontFoot = { x: 18, y: 0 };
    p.backFoot = { x: -18, y: 0 };
  }

  // --- hitstun -------------------------------------------------------------
  if (f.hitstun > 0) {
    p.lean = -0.32 - Math.min(0.2, (f.hitstun || 0) / 120);
    p.headTilt = -0.2;
    p.frontHand = { x: 14, y: -88 };
    p.backHand = { x: -26, y: -76 };
    p.frontFoot = { x: 24, y: -10 };
    p.backFoot = { x: -8, y: -2 };
    p.legBendF = 10;
    p.legBendB = -6;
    if (f.tumble) p.spin = Math.sin(t * 0.26) * 0.34;
  }

  // --- dodge ---------------------------------------------------------------
  if (f.action === 'dodge') {
    const prog = (f.dodgeTimer || 0) / Math.max(1, f.dodgeDuration || 18);
    if (grounded) {
      p.spin = prog * TAU;
      p.hipY += 10; p.shoulderY += 10; p.headY += 9;
      p.frontHand = { x: 13, y: -46 };
      p.backHand = { x: -10, y: -46 };
      p.frontFoot = { x: 10, y: -7 };
      p.backFoot = { x: -9, y: -7 };
    } else {
      p.lean = 0.12;
      p.frontHand = { x: 24, y: -88 };
      p.backHand = { x: -24, y: -86 };
      p.frontFoot = { x: 14, y: -6 };
      p.backFoot = { x: -13, y: -3 };
    }
  }

  // --- respawn -------------------------------------------------------------
  if (f.respawnGlow > 0 && f.action !== 'shield') {
    p.frontHand = { x: 26, y: -72 };
    p.backHand = { x: -24, y: -70 };
    p.frontFoot = { x: 9, y: -4 };
    p.backFoot = { x: -8, y: -2 };
    p.glow = 1;
  }

  // --- attacks -------------------------------------------------------------
  if (f.action === 'attack' && f.move) {
    const m = f.move;
    const d = f.attackFrame || 0;
    const start = m.startup || 4;
    const end = start + (m.active || 3);
    const total = end + (m.recovery || 10);
    const wind = clamp(d / start, 0, 1);
    const active = d >= start && d < end;
    const rec = d >= end ? clamp((d - end) / Math.max(1, m.recovery), 0, 1) : 0;
    const ext = active ? 1 : d < start ? Math.sin(wind * Math.PI * 0.5) * 0.28 : 1 - rec;
    const anim = m.anim || 'jab';

    if (anim === 'jab') {
      p.frontHand = { x: 12 + ext * 37, y: -64 - ext * 2 };
      p.backHand = { x: -14, y: -60 };
      p.lean = 0.05 + ext * 0.1;
      p.frontFoot = { x: 20, y: 0 };
    } else if (anim === 'side') {
      p.lean = -0.06 + ext * 0.26;
      p.frontHand = { x: 6 + ext * 50, y: -70 + ext * 8 };
      p.backHand = { x: -20 - ext * 8, y: -56 };
      p.frontFoot = { x: 22 + ext * 12, y: 0 };
      p.backFoot = { x: -18, y: 0 };
    } else if (anim === 'up') {
      p.hipY += 8; p.shoulderY += 6; p.headY += 5;
      p.frontHand = { x: 12, y: -80 - ext * 46 };
      p.backHand = { x: -18, y: -62 };
      p.headTilt = -0.18;
      p.frontFoot = { x: 17, y: 0 };
      p.backFoot = { x: -17, y: 0 };
    } else if (anim === 'down') {
      p.hipY += 13; p.shoulderY += 11; p.headY += 10;
      p.lean = 0.12;
      p.frontFoot = { x: 18 + ext * 30, y: -3 };
      p.backFoot = { x: -19, y: 0 };
      p.frontHand = { x: -12, y: -32 };
      p.backHand = { x: -24, y: -42 };
    } else if (anim === 'dash') {
      p.lean = 0.3 + ext * 0.12;
      p.frontHand = { x: 34 + ext * 12, y: -58 };
      p.backHand = { x: -26, y: -68 };
      p.frontFoot = { x: 20, y: -6 };
      p.backFoot = { x: -20, y: -8 };
    } else if (anim === 'nair') {
      p.spin = d * 0.3;
      p.frontHand = { x: 34, y: -62 };
      p.backHand = { x: -34, y: -62 };
      p.frontFoot = { x: 15, y: -12 };
      p.backFoot = { x: -14, y: -10 };
      p.legBendF = 10; p.legBendB = -10;
    } else if (anim === 'fair') {
      p.lean = 0.15;
      p.frontHand = { x: 20 + ext * 34, y: -78 };
      p.backHand = { x: -8 + ext * 20, y: -66 };
      p.frontFoot = { x: -6, y: -8 };
      p.backFoot = { x: -20, y: -4 };
    } else if (anim === 'uair') {
      p.spin = d * 0.18;
      p.frontHand = { x: 13, y: -118 };
      p.backHand = { x: -13, y: -110 };
      p.frontFoot = { x: 8, y: -10 };
      p.backFoot = { x: -8, y: -8 };
      p.headTilt = -0.2;
    } else if (anim === 'dair') {
      p.frontHand = { x: 16, y: -104 };
      p.backHand = { x: -16, y: -104 };
      p.frontFoot = { x: 8, y: 2 };
      p.backFoot = { x: -7, y: 1 };
      p.lean = 0.04;
    } else if (anim === 'cast') {
      p.frontHand = { x: 16 + ext * 32, y: -62 };
      p.backHand = { x: 6 + ext * 30, y: -58 };
      p.lean = -0.04 + ext * 0.06;
      p.frontFoot = { x: 20, y: 0 };
      p.backFoot = { x: -18, y: 0 };
      p.glow = 0.7 + ext * 0.3;
    } else if (anim === 'lunge') {
      p.lean = 0.32 + ext * 0.14;
      p.frontHand = { x: 24 + ext * 26, y: -56 };
      p.backHand = { x: -28, y: -70 };
      p.frontFoot = { x: 15, y: -8 };
      p.backFoot = { x: -24, y: -10 };
      p.glow = 0.5 + ext * 0.5;
    } else if (anim === 'rise') {
      p.hipY -= 4; p.shoulderY -= 5; p.headY -= 5;
      p.frontHand = { x: 9, y: -86 - ext * 46 };
      p.backHand = { x: -12, y: -64 };
      p.frontFoot = { x: 7, y: -8 };
      p.backFoot = { x: -5, y: -3 };
      p.headTilt = -0.18;
      p.glow = 1;
    } else if (anim === 'counter') {
      p.hipY += 8; p.shoulderY += 7; p.headY += 6;
      p.frontHand = { x: 14, y: -60 };
      p.backHand = { x: 2, y: -64 };
      p.frontFoot = { x: 19, y: 0 };
      p.backFoot = { x: -19, y: 0 };
      p.lean = -0.08;
      p.glow = 0.45 + (f.counterFlash ? 1 : 0);
    } else if (anim === 'lash') {
      p.lean = -0.04 + ext * 0.16;
      p.frontHand = { x: 16 + ext * 56, y: -60 };
      p.backHand = { x: -24, y: -58 };
      p.frontFoot = { x: 22, y: 0 };
      p.backFoot = { x: -20, y: 0 };
      p.glow = 0.6;
    } else {
      p.frontHand = { x: 14 + ext * 32, y: -64 };
      p.lean = ext * 0.12;
    }

    if (f.charging) {
      p.lean -= 0.12;
      p.frontHand = { x: 0, y: -50 };
      p.backHand = { x: -18, y: -48 };
      p.hipY += 5; p.shoulderY += 4; p.headY += 3;
      p.bob += Math.sin(t * 0.9) * 1.2;
      p.glow = 1;
    }
    if (f.armor) p.glow = Math.max(p.glow, 0.4);
  }

  if (f.landSquash > 0) {
    const s = f.landSquash / 9;
    p.hipY += 4 * s;
    p.shoulderY += 4 * s;
    p.headY += 3 * s;
    p.frontFoot.x += 6 * s;
    p.backFoot.x -= 6 * s;
  }
  return p;
}

// ---------------------------------------------------------------------------
// Main fighter draw
// ---------------------------------------------------------------------------
export function drawFighter(ctx, f, time, opts = {}) {
  if (!f || f.invisible) return;
  const char = f.char || CHAR_MAP[f.charId];
  if (!char) return;
  const size = char.physics.size || 1;
  const facing = f.facing || 1;
  const p = buildPose(f, time);
  const P = char.palette;
  const flicker = f.invincible > 0 && Math.floor((f.animTime || time) / 3) % 2 === 0 && f.hitstun <= 0;

  ctx.save();
  ctx.translate(f.x, f.y);

  if (f.respawnGlow > 0) {
    const a = Math.min(0.5, f.respawnGlow / 120);
    glowCircle(ctx, 0, -52, 70, P.glow, a);
  }
  if (f.damage >= 100 && f.alive !== false) {
    glowCircle(ctx, 0, -50, 64, '#ff2f4f', Math.min(0.3, (f.damage - 80) / 400));
  }

  ctx.scale(size * facing, size);
  if (typeof opts.fade === 'number') ctx.globalAlpha = opts.fade;

  // rotate around the torso for spins and leans
  if (p.spin) {
    ctx.translate(0, -40);
    ctx.rotate(p.spin);
    ctx.translate(0, 40);
  }
  if (p.lean) {
    ctx.translate(0, -38);
    ctx.rotate(p.lean);
    ctx.translate(0, 38);
  }

  drawFigure(ctx, f, char, p, P, opts);

  if (f.hitFlash > 4) {
    ctx.globalAlpha = Math.min(0.75, f.hitFlash / 12);
    const white = { skin: '#fff', primary: '#fff', secondary: '#fff', trim: '#fff', hair: '#fff', glow: '#fff', accent: '#fff' };
    drawFigure(ctx, f, char, p, white, { ...opts, flat: true });
    ctx.globalAlpha = 1;
  }
  if (flicker) ctx.globalAlpha = 1;
  ctx.restore();
}

function drawFigure(ctx, f, char, p, P, opts) {
  const id = char.id;
  const bulk = id === 'glacier' ? 1.28 : id === 'volt' ? 0.9 : id === 'sprout' ? 0.94 : 1;
  const hipW = 20 * bulk;
  const shoulderW = 25 * bulk;
  const armW = 8 * bulk;
  const legW = 9.5 * bulk;
  const outline = opts.flat ? null : OUTLINE;
  const darkP = opts.flat ? P.primary : shade(P.primary, -0.25);
  const darkS = opts.flat ? P.secondary : shade(P.secondary, -0.2);

  // ami high-damage heat shimmer
  if (!opts.flat && (f.charging || p.glow > 0)) {
    const gx = p.frontHand.x;
    glowCircle(ctx, gx, p.frontHand.y, 26, P.glow, 0.18 + p.glow * 0.2);
  }

  // back leg
  const hipBack = { x: -hipW * 0.18, y: p.hipY + 1 };
  limb2(ctx, hipBack.x, hipBack.y, p.backFoot.x, p.backFoot.y - 4, p.legBendB * 0.8, -0.02, legW, darkS, outline);
  boot(ctx, p.backFoot.x, p.backFoot.y, P, darkS, outline, -1, opts);

  // back arm
  const shoulderBack = { x: -shoulderW * 0.28, y: p.shoulderY + 3 };
  limb2(ctx, shoulderBack.x, shoulderBack.y, p.backHand.x, p.backHand.y, p.armBendB, 0.02, armW * 0.92, darkP, outline);
  hand(ctx, p.backHand.x, p.backHand.y, 4.6 * bulk, P, id, darkP, outline, opts);

  // torso
  drawTorso(ctx, p, P, hipW, shoulderW, outline, id, opts);
  if (!opts.flat) drawEmblem(ctx, id, p, P);

  // front leg
  const hipFront = { x: hipW * 0.2, y: p.hipY + 1 };
  limb2(ctx, hipFront.x, hipFront.y, p.frontFoot.x, p.frontFoot.y - 4, p.legBendF * 0.8, 0.02, legW, P.secondary, outline);
  boot(ctx, p.frontFoot.x, p.frontFoot.y, P, P.secondary, outline, 1, opts);

  // head + hair/back accessories
  drawHeadBack(ctx, id, p, P, outline, opts);
  drawHead(ctx, id, p, P, outline, opts);
  drawHeadFront(ctx, id, p, P, outline, opts, f);

  // front arm
  const shoulderFront = { x: shoulderW * 0.26, y: p.shoulderY + 2 };
  limb2(ctx, shoulderFront.x, shoulderFront.y, p.frontHand.x, p.frontHand.y, p.armBendF, 0.03, armW, P.primary, outline);
  hand(ctx, p.frontHand.x, p.frontHand.y, 4.9 * bulk, P, id, P.primary, outline, opts);

  // accessories that move (scarves, flames)
  drawAccessory(ctx, id, p, P, f, outline, opts);
}

function drawTorso(ctx, p, P, hipW, shoulderW, outline, id, opts) {
  const topY = p.shoulderY;
  const botY = p.hipY;
  ctx.beginPath();
  ctx.moveTo(-hipW * 0.5, botY);
  ctx.quadraticCurveTo(-hipW * 0.62, botY - 9, -shoulderW * 0.46, topY + 5);
  ctx.quadraticCurveTo(-shoulderW * 0.5, topY - 2, -shoulderW * 0.24, topY - 3);
  ctx.quadraticCurveTo(0, topY - 6, shoulderW * 0.24, topY - 3);
  ctx.quadraticCurveTo(shoulderW * 0.5, topY - 2, shoulderW * 0.46, topY + 5);
  ctx.quadraticCurveTo(hipW * 0.62, botY - 9, hipW * 0.5, botY);
  ctx.closePath();
  const grad = ctx.createLinearGradient(-shoulderW / 2, topY, shoulderW / 2, botY);
  grad.addColorStop(0, opts.flat ? P.primary : mix(P.primary, '#ffffff', 0.16));
  grad.addColorStop(1, opts.flat ? P.primary : shade(P.primary, -0.18));
  ctx.fillStyle = grad;
  ctx.fill();
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 2.2; ctx.stroke(); }

  if (!opts.flat) {
    // belt / waist trim
    ctx.fillStyle = P.trim;
    roundRect(ctx, -hipW * 0.55, botY - 5, hipW * 1.1, 5, 2);
    ctx.fill();
    if (id === 'glacier') {
      // chest plate
      ctx.fillStyle = hexA('#e8fbff', 0.5);
      ctx.beginPath();
      ctx.moveTo(-shoulderW * 0.32, topY + 8);
      ctx.lineTo(0, topY + 2);
      ctx.lineTo(shoulderW * 0.32, topY + 8);
      ctx.lineTo(shoulderW * 0.2, topY + 24);
      ctx.lineTo(-shoulderW * 0.2, topY + 24);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = hexA('#ffffff', 0.6); ctx.lineWidth = 1; ctx.stroke();
    } else if (id === 'volt') {
      ctx.strokeStyle = P.trim;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-shoulderW * 0.34, topY + 9);
      ctx.lineTo(shoulderW * 0.3, topY + 20);
      ctx.stroke();
    } else if (id === 'sprout') {
      // leaf collar
      ctx.fillStyle = shade(P.primary, 0.18);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * shoulderW * 0.28, topY + 4, 9, 4.5, s * 0.5, 0, TAU);
        ctx.fill();
      }
    }
  }
}

function drawEmblem(ctx, id, p, P) {
  const x = 0;
  const y = p.shoulderY + 17;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = P.trim;
  ctx.strokeStyle = hexA('#000000', 0.2);
  ctx.lineWidth = 1;
  if (id === 'blaze') {
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.quadraticCurveTo(6, -2, 3, 4);
    ctx.quadraticCurveTo(0, 7, -3, 3);
    ctx.quadraticCurveTo(-6, -2, 0, -7);
    ctx.fill();
  } else if (id === 'volt') {
    poly(ctx, [[1, -8], [-5, 1], [-1, 1], [-2, 8], [5, -1], [1, -1]]);
    ctx.fill();
  } else if (id === 'glacier') {
    ctx.strokeStyle = P.trim;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(a) * 6, -Math.sin(a) * 6);
      ctx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 3.5, 0.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = P.trim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-4, 2); ctx.lineTo(4, -2);
    ctx.stroke();
  }
  ctx.restore();
}

function hand(ctx, x, y, r, P, id, armColor, outline, opts) {
  ctx.fillStyle = id === 'glacier' ? shade(P.skin, 0.1) : (id === 'sprout' ? P.primary : P.skin);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 1.6; ctx.stroke(); }
  if (id === 'glacier' && !opts.flat) {
    ctx.fillStyle = hexA('#e9fbff', 0.35);
    ctx.beginPath(); ctx.arc(x - 1, y - 1, r * 0.5, 0, TAU); ctx.fill();
  }
}

function boot(ctx, x, y, P, legColor, outline, side, opts) {
  ctx.save();
  ctx.translate(x, y - 2);
  ctx.scale(side, 1);
  ctx.fillStyle = opts.flat ? P.primary : (P.trim && P.accent ? mix(P.secondary, P.trim, 0.25) : P.trim);
  roundRect(ctx, -6, -2, 16, 6, 3);
  ctx.fill();
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.restore();
}

function drawHeadBack(ctx, id, p, P, outline, opts) {
  const hx = p.headX;
  const hy = p.headY;
  const r = p.headR;
  if (id === 'blaze') {
    // spiky hair silhouette
    ctx.save();
    ctx.translate(hx, hy);
    poly(ctx, [
      [-r - 2, 2], [-r - 5, -8], [-r + 1, -6], [-2, -r - 13],
      [5, -r - 5], [12, -r - 11], [12, -r + 1], [r + 4, -3],
      [r + 1, 8], [8, 10], [0, 7],
    ]);
    ctx.fillStyle = opts.flat ? P.primary : P.hair;
    ctx.fill();
    if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 2; ctx.stroke(); }
    // headband tails
    ctx.strokeStyle = opts.flat ? P.primary : P.trim;
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    const w = Math.sin((p.bob + 2) * 0.5) * 2;
    ctx.beginPath();
    ctx.moveTo(-r + 1, -1);
    ctx.quadraticCurveTo(-r - 11, 4 + w, -r - 18, 12 + w);
    ctx.moveTo(-r + 1, 1);
    ctx.quadraticCurveTo(-r - 9, 9 + w, -r - 14, 17 + w);
    ctx.stroke();
    ctx.restore();
  } else if (id === 'volt') {
    // scarf behind
    ctx.save();
    ctx.strokeStyle = opts.flat ? P.primary : P.trim;
    ctx.lineCap = 'round';
    const wave = Math.sin((p.bob + 1) * 0.8) * 3;
    for (let i = 0; i < 2; i++) {
      ctx.lineWidth = 5 - i * 1.5;
      ctx.beginPath();
      ctx.moveTo(hx - 6, hy + 16 + i * 2);
      ctx.bezierCurveTo(hx - 22, hy + 16 + wave, hx - 28, hy + 26 - wave, hx - 40 - i * 4, hy + 24 + wave);
      ctx.stroke();
    }
    ctx.restore();
  } else if (id === 'glacier') {
    // horns
    ctx.save();
    ctx.translate(hx, hy);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * (r - 2), -r + 2);
      ctx.quadraticCurveTo(s * (r + 7), -r - 5, s * (r + 5), -r - 14);
      ctx.quadraticCurveTo(s * (r + 1), -r - 5, s * (r - 6), -r + 4);
      ctx.closePath();
      ctx.fillStyle = opts.flat ? P.primary : '#e8f7ff';
      ctx.fill();
      if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 1.6; ctx.stroke(); }
    }
    ctx.restore();
  } else if (id === 'sprout') {
    // leaf crown
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(Math.sin((p.bob + 4) * 0.15) * 0.04);
    for (const [s, a, l] of [[-1, -0.9, 13], [1, -0.6, 15], [0, -1.5, 11]]) {
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(s * 4, -r - 5, l, 5, s * 0.2, 0, TAU);
      ctx.fillStyle = opts.flat ? P.primary : (s < 0 ? shade(P.primary, -0.12) : shade(P.primary, 0.12));
      ctx.fill();
      if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 1.4; ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }
}

function drawHead(ctx, id, p, P, outline, opts) {
  const hx = p.headX;
  const hy = p.headY;
  const r = p.headR;
  // neck
  ctx.fillStyle = opts.flat ? P.primary : shade(P.skin, -0.12);
  roundRect(ctx, hx - 4, hy + r - 3, 8, 8, 3);
  ctx.fill();

  ctx.save();
  ctx.translate(hx, hy);
  if (p.headTilt) ctx.rotate(p.headTilt);
  // face base
  if (id === 'glacier') {
    ctx.fillStyle = opts.flat ? P.primary : '#dff4ff';
    ctx.beginPath();
    ctx.moveTo(-r, 2);
    ctx.quadraticCurveTo(-r - 2, -r - 2, 0, -r - 3);
    ctx.quadraticCurveTo(r + 2, -r - 2, r, 2);
    ctx.quadraticCurveTo(r * 0.7, r + 6, 0, r + 7);
    ctx.quadraticCurveTo(-r * 0.7, r + 6, -r, 2);
    ctx.fill();
    if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 2; ctx.stroke(); }
    // helmet band
    ctx.fillStyle = opts.flat ? P.primary : P.secondary;
    roundRect(ctx, -r - 1, -r - 2, r * 2 + 2, 7, 3);
    ctx.fill();
  } else {
    ctx.fillStyle = opts.flat ? P.primary : P.skin;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 1.02, 0, 0, TAU);
    ctx.fill();
    if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 2; ctx.stroke(); }
  }

  // eyes
  if (id === 'volt') {
    // mask
    ctx.fillStyle = opts.flat ? P.primary : P.secondary;
    ctx.beginPath();
    ctx.ellipse(0, 5, r, r * 0.72, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = opts.flat ? '#fff' : '#9ff4ff';
    ctx.shadowColor = '#45e3ff'; ctx.shadowBlur = 7;
    for (const ex of [-5.5, 5.5]) {
      ctx.beginPath();
      ctx.ellipse(ex, -2, 3.2, 1.7, -0.15, 0, TAU);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  } else if (id === 'glacier') {
    ctx.fillStyle = opts.flat ? '#fff' : '#7fe6ff';
    ctx.shadowColor = '#7fe6ff'; ctx.shadowBlur = 8;
    for (const ex of [-5.5, 5.5]) {
      ctx.beginPath();
      ctx.ellipse(ex, -1, 2.8, 2.1, 0, 0, TAU);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // ice beard
    ctx.fillStyle = opts.flat ? P.primary : '#eafaff';
    poly(ctx, [[-9, 8], [-5, 16], [-1, 9], [4, 17], [8, 8], [5, 13], [0, 7]]);
    ctx.fill();
  } else if (id === 'sprout') {
    for (const ex of [-5.5, 5.5]) {
      ctx.fillStyle = opts.flat ? '#fff' : '#142018';
      ctx.beginPath(); ctx.ellipse(ex, -1, 3.1, 3.9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex + 1.2, -2.6, 1.15, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = '#284022'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 5, 3, 0.2, Math.PI - 0.2); ctx.stroke();
  } else {
    // blaze
    ctx.fillStyle = '#fff';
    for (const ex of [-5.5, 5.5]) {
      ctx.beginPath(); ctx.ellipse(ex, -1, 3, 3.8, 0, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = opts.flat ? '#000' : '#2a1720';
    for (const ex of [-5.5, 5.5]) {
      ctx.beginPath(); ctx.arc(ex + 1.1, -0.6, 1.5, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = opts.flat ? '#000' : P.hair;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-8.5, -6); ctx.lineTo(-3, -7.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, -7.4); ctx.lineTo(8.5, -6); ctx.stroke();
    ctx.strokeStyle = opts.flat ? '#000' : '#7c3a2e';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(1, 7); ctx.quadraticCurveTo(3.5, 5.4, 5.6, 7); ctx.stroke();
  }

  // headband / hat / flower front
  if (id === 'blaze') {
    ctx.strokeStyle = opts.flat ? '#fff' : P.trim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r + 1, -r * 0.42);
    ctx.quadraticCurveTo(0, -r * 0.58, r - 1, -r * 0.45);
    ctx.stroke();
    ctx.fillStyle = opts.flat ? '#fff' : P.trim;
    ctx.beginPath(); ctx.arc(-r + 1, -r * 0.42, 1.6, 0, TAU); ctx.fill();
  } else if (id === 'sprout') {
    // flower petals
    ctx.fillStyle = opts.flat ? '#fff' : P.trim;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - 0.6;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 7, -r - 1 + Math.sin(a) * 4, 5, 3, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = opts.flat ? '#fff' : '#ff9a4d';
    ctx.beginPath(); ctx.arc(0, -r - 1, 3.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawHeadFront() {}

function drawAccessory(ctx, id, p, P, f, outline, opts) {
  if (id === 'blaze') {
    const flame = (p.glow > 0.2 || f.charging) && !opts.flat;
    if (flame) {
      drawFlame(ctx, p.frontHand.x + 3, p.frontHand.y - 4, 16 + Math.sin(p.bob * 2) * 2, P);
      drawFlame(ctx, p.backHand.x, p.backHand.y - 3, 10, P);
    }
  } else if (id === 'volt') {
    if ((p.glow > 0.2 || f.charging) && !opts.flat) {
      ctx.strokeStyle = P.glow;
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = 0.8;
      for (let i = 0; i < 2; i++) {
        const hx = i ? p.backHand : p.frontHand;
        ctx.beginPath();
        ctx.moveTo(hx.x - 8, hx.y - 7);
        ctx.lineTo(hx.x - 2, hx.y - 2);
        ctx.lineTo(hx.x - 6, hx.y + 2);
        ctx.lineTo(hx.x + 3, hx.y + 8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  } else if (id === 'glacier') {
    if (!opts.flat) {
      // frost mist
      const t = (f.animTime || 0) * 0.05;
      ctx.fillStyle = hexA('#bff4ff', 0.16);
      for (let i = 0; i < 3; i++) {
        const x = p.headX - 16 - i * 5 - Math.sin(t + i) * 3;
        const y = p.headY + 8 + Math.sin(t * 1.3 + i) * 3;
        ctx.beginPath(); ctx.arc(x, y, 4 - i * 0.7, 0, TAU); ctx.fill();
      }
    }
  } else if (id === 'sprout') {
    if (!opts.flat && (p.glow > 0.3 || f.charging)) {
      ctx.fillStyle = hexA(P.trim, 0.85);
      for (let i = 0; i < 3; i++) {
        const a = (f.animTime * 0.07 + i * 2.1);
        ctx.beginPath();
        ctx.ellipse(p.frontHand.x + Math.cos(a) * 9, p.frontHand.y + Math.sin(a) * 7, 4, 2, a, 0, TAU);
        ctx.fill();
      }
    }
  }
}

function drawFlame(ctx, x, y, size, P) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const s = size * (1 - i * 0.24);
    ctx.fillStyle = hexA(i === 0 ? P.glow : i === 1 ? '#ffb347' : '#fff1b8', 0.55 - i * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, s);
    ctx.quadraticCurveTo(-s * 0.7, s * 0.15, -s * 0.12, -s);
    ctx.quadraticCurveTo(0, -s * 0.3, s * 0.5, -s * 0.3);
    ctx.quadraticCurveTo(s * 0.6, s * 0.3, 0, s);
    ctx.fill();
  }
  ctx.restore();
}

export function drawFighterShadow(ctx, f, groundY, scale = 1) {
  if (!f || f.invisible) return;
  const dist = Math.max(0, groundY - f.y);
  const a = clamp(0.34 - dist / 900, 0.05, 0.34);
  const w = (34 - Math.min(16, dist / 28)) * (f.char?.physics.size || 1);
  const g = ctx.createRadialGradient(f.x, groundY + 2, 1, f.x, groundY + 2, Math.max(8, w));
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(f.x, groundY + 3, Math.max(8, w), Math.max(3, w * 0.32), 0, 0, TAU);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Portrait / avatar rendering
// ---------------------------------------------------------------------------
export function drawCharacterCard(canvas, charId) {
  const char = CHAR_MAP[charId];
  if (!char) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 260;
  const h = canvas.clientHeight || 190;
  canvas.width = Math.max(2, Math.round(w * dpr));
  canvas.height = Math.max(2, Math.round(h * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const P = char.palette;
  const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 4, w * 0.5, h * 0.5, h * 0.7);
  g.addColorStop(0, hexA(P.ui[0], 0.35));
  g.addColorStop(1, hexA(P.ui[1], 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = hexA(P.ui[0], 0.28);
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.58, w * (0.2 + i * 0.12), h * (0.08 + i * 0.05), 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();

  const fake = {
    char, charId, x: w * 0.5, y: h * 0.9, facing: 1, vx: 0, vy: 0,
    grounded: true, action: null, move: null, animTime: 60 + (char.num * 17), slot: 0,
    damage: 0, invincible: 0, respawnGlow: 0, hitFlash: 0, hitstun: 0, charging: false,
    crouching: false, landSquash: 0, airDodgeUsed: false, trail: [], dodgeTimer: 0,
  };
  const scale = Math.min(w / 190, h / 175) * 1.5;
  ctx.save();
  ctx.translate(fake.x, fake.y);
  ctx.scale(scale, scale);
  ctx.translate(-fake.x, -fake.y);
  drawFighter(ctx, fake, 0);
  ctx.restore();
}

export function drawAvatar(canvas, charId) {
  const char = CHAR_MAP[charId];
  if (!char) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = canvas.clientWidth || 64;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const P = char.palette;
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, hexA(P.ui[0], 0.55));
  g.addColorStop(1, hexA(P.ui[1], 0.3));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const fake = {
    char, x: size * 0.5, y: size * 1.0, facing: 1, vx: 0, vy: 0,
    grounded: true, action: null, animTime: 40, slot: 0, damage: 0,
    invincible: 0, respawnGlow: 0, hitFlash: 0, hitstun: 0, charging: false,
    crouching: false, landSquash: 0, airDodgeUsed: false, trail: [],
  };
  const scale = size / 135;
  ctx.save();
  ctx.translate(fake.x, fake.y);
  ctx.scale(scale, scale);
  ctx.translate(-fake.x, -fake.y);
  drawFighter(ctx, fake, 0);
  ctx.restore();
}
