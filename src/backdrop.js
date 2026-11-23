// ---------------------------------------------------------------------------
// Backdrop — skies, parallax, platforms and stage thumbnails.
// ---------------------------------------------------------------------------
import { CHAR_MAP, STAGE_MAP } from './data.js';
import {
  TAU, clamp, hexA, mix, shade, poly, roundRect, glowCircle,
} from './draw-utils.js';
import { drawFighter } from './figure.js';

function ridge(ctx, w, base, amp, color, seed, scroll, step = 46) {
  ctx.beginPath();
  ctx.moveTo(-80, base + 400);
  for (let x = -80; x <= w + 80; x += step) {
    const sx = x + scroll;
    const y = base
      - amp * (0.55 + 0.3 * Math.sin(sx * 0.008 + seed) + 0.15 * Math.sin(sx * 0.021 + seed * 2.3))
      - amp * 0.12 * Math.sin(sx * 0.05 + seed * 4);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w + 80, base + 400);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function peaks(ctx, w, base, amp, color, snow, seed, scroll) {
  const pts = [];
  const spacing = 150;
  for (let i = -2; i < Math.ceil(w / spacing) + 3; i++) {
    const x = i * spacing + ((scroll + seed * 41) % spacing);
    const h = amp * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7 + seed)));
    pts.push([x - spacing * 0.62, base, x, base - h, x + spacing * 0.55, base]);
  }
  ctx.fillStyle = color;
  for (const [x1, y1, x2, y2, x3, y3] of pts) {
    poly(ctx, [[x1, y1], [x2, y2], [x3, y3]]);
    ctx.fill();
    // snow cap
    const sy = y2 + (y1 - y2) * 0.24;
    const sx = x2 + (x3 - x2) * 0.22;
    const lx = x2 + (x1 - x2) * 0.22;
    ctx.fillStyle = snow;
    poly(ctx, [[x2, y2], [sx, sy], [x2 + (sx - x2) * 0.15, sy + 10], [lx, sy], [x2 + (lx - x2) * 0.2, sy + 7]]);
    ctx.fill();
    ctx.fillStyle = color;
  }
}

function cloud(ctx, x, y, s, alpha, color = '#fff') {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, 42 * s, 14 * s, 0, 0, TAU);
  ctx.ellipse(x - 30 * s, y + 2 * s, 26 * s, 10 * s, 0, 0, TAU);
  ctx.ellipse(x + 32 * s, y + 1 * s, 30 * s, 11 * s, 0, 0, TAU);
  ctx.ellipse(x + 4 * s, y - 8 * s, 24 * s, 14 * s, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawBackground(ctx, view, stage, cam, time) {
  const w = view.w;
  const h = view.h;
  const sky = stage.sky;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, sky[0]);
  grad.addColorStop(0.38, sky[1]);
  grad.addColorStop(0.72, sky[2]);
  grad.addColorStop(1, sky[3]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const camX = cam.x || 0;
  const camY = cam.y || 0;
  const horizon = h * 0.64;
  const scale = h / 720;

  // stars (sky + frost)
  if (stage.kind !== 'ember') {
    ctx.save();
    for (let i = 0; i < 52; i++) {
      const sx = ((i * 137.5) % 1) * 0 + ((i * 197.13) % w);
      const sy = ((i * 89.7) % (h * 0.52)) - 10;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.0012 + i));
      ctx.globalAlpha = tw * (stage.kind === 'frost' ? 0.7 : 0.5);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx - camX * 0.01, sy, (i % 5 === 0 ? 1.7 : 0.9) * scale, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // sun / moon / furnace glow
  if (stage.kind === 'sky') {
    const sx = w * 0.72 - camX * 0.02;
    const sy = h * 0.34;
    const r = Math.min(w, h) * 0.14;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.2);
    g.addColorStop(0, 'rgba(255,226,170,0.55)');
    g.addColorStop(0.25, 'rgba(255,170,110,0.24)');
    g.addColorStop(1, 'rgba(255,120,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const sun = ctx.createLinearGradient(sx, sy - r, sx, sy + r);
    sun.addColorStop(0, '#fff2c8');
    sun.addColorStop(1, '#ffb26b');
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.62, 0, TAU);
    ctx.fill();
  } else if (stage.kind === 'frost') {
    const sx = w * 0.2 - camX * 0.015;
    const sy = h * 0.2;
    const r = Math.min(w, h) * 0.09;
    glowCircle(ctx, sx, sy, r * 2.6, '#a8e8ff', 0.22);
    ctx.fillStyle = '#e8fbff';
    ctx.beginPath(); ctx.arc(sx, sy, r * 0.55, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(140,180,210,0.35)';
    ctx.beginPath(); ctx.arc(sx - r * 0.18, sy - r * 0.12, r * 0.14, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + r * 0.16, sy + r * 0.14, r * 0.1, 0, TAU); ctx.fill();

    // aurora ribbons
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const y = h * (0.18 + i * 0.07);
      const g = ctx.createLinearGradient(0, y - 60, w, y + 60);
      g.addColorStop(0, hexA(stage.accent2, 0));
      g.addColorStop(0.35, hexA(stage.accent, 0.13 - i * 0.02));
      g.addColorStop(0.7, hexA(stage.accent2, 0.1 - i * 0.02));
      g.addColorStop(1, hexA(stage.accent, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 40) {
        ctx.lineTo(x, y + Math.sin(x * 0.006 + time * 0.0007 + i * 1.8) * 26 + Math.sin(x * 0.014 + i) * 10);
      }
      for (let x = w; x >= 0; x -= 40) {
        ctx.lineTo(x, y + 46 + Math.sin(x * 0.005 + time * 0.0009 + i * 2.2) * 30);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else {
    // ember furnace haze
    const g = ctx.createRadialGradient(w * 0.5, h * 0.9, 20, w * 0.5, h * 0.9, w * 0.7);
    g.addColorStop(0, 'rgba(255,150,60,0.45)');
    g.addColorStop(0.4, 'rgba(200,50,30,0.18)');
    g.addColorStop(1, 'rgba(20,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // distant clouds
  if (stage.kind === 'sky') {
    for (let i = 0; i < 7; i++) {
      const base = i * 337.7;
      const x = ((base + time * (0.008 + i * 0.002) - camX * 0.05) % (w + 400)) - 200;
      const y = h * (0.18 + ((i * 71) % 100) / 300);
      cloud(ctx, x, y, 0.8 + (i % 4) * 0.24, 0.06 + (i % 3) * 0.03, '#ffe2c4');
    }
  }

  // mountain layers
  const scroll = -camX * 0.08;
  if (stage.kind === 'sky') {
    ridge(ctx, w, horizon + 40, h * 0.22, hexA('#2a1a44', 0.55), 3.1, scroll * 0.4, 60);
    ridge(ctx, w, horizon + 70, h * 0.28, hexA('#241638', 0.8), 6.4, scroll * 0.8, 48);
    ridge(ctx, w, horizon + 120, h * 0.2, '#1a1028', 2.2, scroll * 1.2, 40);
  } else if (stage.kind === 'ember') {
    ridge(ctx, w, horizon + 30, h * 0.13, hexA('#2a0b10', 0.8), 4.8, -camX * 0.05, 70);
    // factory towers
    const scroll2 = -camX * 0.12;
    for (let i = 0; i < 9; i++) {
      const x = ((i * 173 + scroll2) % (w + 240)) - 120;
      const tw = 16 + (i % 4) * 11;
      const th = 50 + (i % 5) * 46;
      ctx.fillStyle = i % 2 ? '#1c080d' : '#250a10';
      ctx.fillRect(x, horizon - th, tw, th + 160);
      ctx.fillStyle = 'rgba(255,120,60,0.55)';
      for (let j = 0; j < 3; j++) {
        if ((i + j) % 3 === 0) ctx.fillRect(x + tw * 0.25, horizon - th + 14 + j * 19, tw * 0.5, 4);
      }
      ctx.fillStyle = 'rgba(255,180,100,0.25)';
      ctx.fillRect(x + tw * 0.5 - 2, horizon - th - 18, 4, 18);
    }
    // lava glow at the bottom
    const lg = ctx.createLinearGradient(0, h * 0.72, 0, h);
    lg.addColorStop(0, 'rgba(255,90,30,0)');
    lg.addColorStop(1, 'rgba(255,120,40,0.3)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
  } else {
    peaks(ctx, w, horizon + 50, h * 0.34, hexA('#102a44', 0.85), hexA('#c8e6f5', 0.75), 2.7, -camX * 0.05);
    peaks(ctx, w, horizon + 105, h * 0.24, hexA('#0b1d31', 0.95), hexA('#a9cfe2', 0.65), 5.9, -camX * 0.09);
  }

  // floating islands (sky)
  if (stage.kind === 'sky') {
    const spots = [
      [-0.05, 0.24, 1.25], [0.27, 0.5, 0.7], [0.86, 0.32, 1.05], [0.63, 0.52, 0.5],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [fx, fy, s] = spots[i];
      const x = fx * w - camX * 0.14 * (i % 2 ? 1 : 0.6) + Math.sin(time * 0.0003 + i) * 5;
      const y = fy * h + Math.cos(time * 0.00025 + i) * 4;
      drawFloatingIsland(ctx, x, y, s * Math.min(1.5, w / 1200 + 0.5), stage, i);
    }
    for (let i = 0; i < 5; i++) {
      const x = ((i * 271 + time * 0.02 - camX * 0.03) % (w + 200)) - 100;
      const y = h * (0.2 + (i % 3) * 0.09);
      ctx.strokeStyle = 'rgba(40,20,45,0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - 7, y);
      ctx.quadraticCurveTo(x - 2, y - 5, x + 3, y - 1);
      ctx.quadraticCurveTo(x + 7, y - 5, x + 12, y);
      ctx.stroke();
    }
  }

  // horizon haze
  const haze = ctx.createLinearGradient(0, horizon - 90, 0, horizon + 90);
  haze.addColorStop(0, 'rgba(255,255,255,0)');
  haze.addColorStop(0.5, hexA(stage.accent, stage.kind === 'ember' ? 0.12 : 0.16));
  haze.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 90, w, 190);

  // rolling fog under the arena
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const y = h * (0.72 + i * 0.07) + Math.sin(time * 0.0005 + i) * 4;
    const a = 0.05 + i * 0.02;
    const g = ctx.createLinearGradient(0, y - 26, 0, y + 30);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, stage.kind === 'ember' ? `rgba(255,120,60,${a})` : `rgba(230,225,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 26, w, 60);
  }
  ctx.restore();
}

function drawFloatingIsland(ctx, x, y, s, stage, seed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(40,24,60,0.85)';
  ctx.beginPath();
  ctx.moveTo(-64, 0);
  ctx.quadraticCurveTo(-40, -18, 0, -16);
  ctx.quadraticCurveTo(45, -17, 68, 0);
  ctx.lineTo(40, 16);
  ctx.lineTo(20, 30);
  ctx.lineTo(-2, 48);
  ctx.lineTo(-20, 26);
  ctx.lineTo(-44, 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = seed % 2 ? '#6a5a8f' : '#746294';
  ctx.beginPath();
  ctx.ellipse(0, -9, 68, 14, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,210,140,0.3)';
  ctx.beginPath(); ctx.ellipse(8, -15, 42, 5, 0, 0, TAU); ctx.fill();
  // trees
  ctx.fillStyle = '#2a1b35';
  for (let i = 0; i < 3; i++) {
    const tx = -36 + i * 30;
    ctx.fillRect(tx, -36, 3, 22);
    ctx.beginPath();
    ctx.moveTo(tx - 11, -34);
    ctx.lineTo(tx + 1.5, -54);
    ctx.lineTo(tx + 13, -34);
    ctx.fill();
  }
  // hanging crystal
  ctx.fillStyle = 'rgba(255,190,110,0.5)';
  ctx.beginPath();
  ctx.moveTo(-16, 34); ctx.lineTo(-9, 48); ctx.lineTo(-2, 32); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Platforms
// ---------------------------------------------------------------------------
export function drawStage(ctx, stage, time, opts = {}) {
  const main = stage.platforms[0];
  drawArenaDecor(ctx, stage, time, opts);

  for (let i = 0; i < stage.platforms.length; i++) {
    const p = stage.platforms[i];
    if (p.main) drawMainPlatform(ctx, p, stage, time, opts);
    else drawFloatPlatform(ctx, p, stage, time, opts, i);
  }
}

function drawArenaDecor(ctx, stage, time, opts) {
  const main = stage.platforms[0];
  const half = main.w / 2;
  if (stage.kind === 'sky') {
    // ruined pillars behind the deck
    for (const side of [-1, 1]) {
      const x = side * (half - 135);
      ctx.fillStyle = 'rgba(38,26,58,0.9)';
      ctx.fillRect(x - 15, -215, 30, 216);
      ctx.fillStyle = 'rgba(94,74,130,0.85)';
      ctx.fillRect(x - 20, -223, 40, 14);
      ctx.fillRect(x - 19, -148, 38, 8);
      ctx.fillStyle = 'rgba(255,196,120,0.25)';
      ctx.fillRect(x - 3, -205, 6, 58);
      // hanging banner
      ctx.fillStyle = hexA(stage.accent, 0.4);
      ctx.beginPath();
      ctx.moveTo(x + side * 10, -200);
      ctx.lineTo(x + side * 10, -155);
      ctx.lineTo(x + side * 22, -168);
      ctx.closePath();
      ctx.fill();
    }
    // central sigil on the floor
    ctx.save();
    ctx.translate(0, 2);
    ctx.scale(1, 0.2);
    ctx.strokeStyle = hexA(stage.accent, 0.3);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 92, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 73, 0, TAU); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 74, Math.sin(a) * 74);
      ctx.lineTo(Math.cos(a) * 91, Math.sin(a) * 91);
      ctx.stroke();
    }
    ctx.restore();
  } else if (stage.kind === 'ember') {
    // rear pipes + furnace mouths
    for (const side of [-1, 1]) {
      const x = side * (half - 100);
      ctx.fillStyle = '#1b0a10';
      ctx.fillRect(x - 22, -188, 44, 190);
      ctx.fillStyle = '#2e1118';
      ctx.fillRect(x - 30, -196, 60, 18);
      ctx.fillStyle = 'rgba(255,120,50,0.55)';
      for (let i = 0; i < 3; i++) ctx.fillRect(x - 13, -165 + i * 34, 26, 9);
      ctx.fillStyle = 'rgba(255,160,80,0.12)';
      ctx.beginPath(); ctx.arc(x, -150, 48, 0, TAU); ctx.fill();
    }
    // central furnace glyph
    ctx.save();
    ctx.translate(0, 10);
    ctx.fillStyle = 'rgba(255,120,45,0.1)';
    ctx.fillRect(-140, 20, 280, 24);
    ctx.strokeStyle = 'rgba(255,150,70,0.32)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-70, 28); ctx.lineTo(-34, 28); ctx.lineTo(-22, 14); ctx.lineTo(22, 14);
    ctx.lineTo(34, 28); ctx.lineTo(70, 28);
    ctx.stroke();
    ctx.restore();
  } else {
    // ice crystals and snow drifts
    for (const side of [-1, 1]) {
      const x = side * (half - 120);
      ctx.fillStyle = 'rgba(130,200,225,0.22)';
      ctx.beginPath();
      ctx.moveTo(x - 34, 4);
      ctx.lineTo(x - 8, -100 - Math.abs(side) * 20);
      ctx.lineTo(x + 4, -42);
      ctx.lineTo(x + 18, -78);
      ctx.lineTo(x + 36, 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(220,250,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // frozen sigil
    ctx.save();
    ctx.translate(0, 3);
    ctx.scale(1, 0.22);
    ctx.strokeStyle = 'rgba(150,240,255,0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 40, Math.sin(a) * 40);
      ctx.lineTo(Math.cos(a + 0.5) * 86, Math.sin(a + 0.5) * 86);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawMainPlatform(ctx, p, stage, time, opts) {
  const x = p.x - p.w / 2;
  const y = p.y;
  const h = p.h;
  const accent = stage.accent;

  // contact shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, x + 6, y + 10, p.w, h + 20, 16);
  ctx.fill();
  ctx.restore();

  // main slab
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, stage.platform.top);
  grad.addColorStop(0.45, stage.platform.top2);
  grad.addColorStop(1, stage.platform.side);
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, p.w, h, 10);
  ctx.fill();

  // top light
  const topLight = ctx.createLinearGradient(0, y, 0, y + 9);
  topLight.addColorStop(0, hexA('#ffffff', 0.5));
  topLight.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = topLight;
  roundRect(ctx, x + 2, y, p.w - 4, 10, 5);
  ctx.fill();

  // glowing rim
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = hexA(accent, 0.85);
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 1);
  ctx.lineTo(x + p.w - 10, y + 1);
  ctx.stroke();
  ctx.restore();

  // surface detail
  ctx.strokeStyle = hexA('#000000', 0.18);
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const tx = x + (p.w / 8) * i;
    ctx.beginPath();
    ctx.moveTo(tx, y + 12);
    ctx.lineTo(tx + (i % 2 ? -3 : 3), y + h - 6);
    ctx.stroke();
  }
  ctx.strokeStyle = hexA('#ffffff', 0.08);
  for (let i = 0; i < 5; i++) {
    const tx = x + 60 + i * (p.w / 5.4);
    ctx.beginPath();
    ctx.moveTo(tx, y + 6);
    ctx.lineTo(tx + 46, y + 6);
    ctx.stroke();
  }

  // underside
  const bottom = y + h;
  if (stage.kind === 'sky') {
    ctx.fillStyle = '#1a1229';
    ctx.beginPath();
    ctx.moveTo(x + 6, bottom - 2);
    ctx.lineTo(x + 30, bottom + 18);
    ctx.lineTo(x + 72, bottom + 30);
    ctx.lineTo(x + 120, bottom + 16);
    ctx.lineTo(x + 200, bottom + 42);
    ctx.lineTo(x + 300, bottom + 22);
    ctx.lineTo(x + 390, bottom + 50);
    ctx.lineTo(x + 470, bottom + 24);
    ctx.lineTo(x + 580, bottom + 44);
    ctx.lineTo(x + 670, bottom + 18);
    ctx.lineTo(x + 760, bottom + 38);
    ctx.lineTo(x + 860, bottom + 20);
    ctx.lineTo(x + 950, bottom + 46);
    ctx.lineTo(x + 1050, bottom + 24);
    ctx.lineTo(x + 1140, bottom + 36);
    ctx.lineTo(x + p.w - 6, bottom - 2);
    ctx.closePath();
    ctx.fill();
    // vines
    ctx.strokeStyle = 'rgba(120,160,90,0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const vx = x + 70 + i * (p.w - 140) / 8;
      ctx.beginPath();
      ctx.moveTo(vx, bottom + 12);
      ctx.quadraticCurveTo(vx + 4, bottom + 28, vx - 5, bottom + 40 + (i % 3) * 8);
      ctx.stroke();
    }
  } else if (stage.kind === 'ember') {
    ctx.fillStyle = '#18090e';
    ctx.fillRect(x + 10, bottom - 4, p.w - 20, 34);
    ctx.strokeStyle = 'rgba(255,120,55,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 30, bottom + 18);
    ctx.lineTo(x + p.w - 30, bottom + 18);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const vx = x + 100 + i * (p.w - 200) / 5;
      ctx.fillStyle = 'rgba(255,120,50,0.65)';
      ctx.beginPath(); ctx.arc(vx, bottom + 18, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,190,90,0.12)';
      ctx.beginPath(); ctx.arc(vx, bottom + 18, 16, 0, TAU); ctx.fill();
    }
  } else {
    ctx.fillStyle = '#101f31';
    ctx.beginPath();
    ctx.moveTo(x + 6, bottom - 2);
    ctx.lineTo(x + p.w - 6, bottom - 2);
    ctx.lineTo(x + p.w - 6, bottom + 16);
    ctx.lineTo(x + 900, bottom + 26);
    ctx.lineTo(x + 760, bottom + 46);
    ctx.lineTo(x + 640, bottom + 28);
    ctx.lineTo(x + 520, bottom + 52);
    ctx.lineTo(x + 400, bottom + 30);
    ctx.lineTo(x + 300, bottom + 44);
    ctx.lineTo(x + 180, bottom + 27);
    ctx.lineTo(x + 90, bottom + 34);
    ctx.lineTo(x + 24, bottom + 18);
    ctx.closePath();
    ctx.fill();
  }

  // edge cap lights
  ctx.fillStyle = hexA(accent, 0.55);
  roundRect(ctx, x + p.w - 12, y + h * 0.22, 5, h * 0.4, 3);
  ctx.fill();
  roundRect(ctx, x + 7, y + h * 0.22, 5, h * 0.4, 3);
  ctx.fill();
}

function drawFloatPlatform(ctx, p, stage, time, opts, idx) {
  const x = p.x - p.w / 2;
  const y = p.y;
  const h = Math.max(20, p.h + 6);
  const accent = stage.accent;

  // soft glow underneath
  glowCircle(ctx, p.x, y + h, p.w * 0.32, accent, 0.1);

  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, stage.platform.top);
  grad.addColorStop(0.55, stage.platform.top2);
  grad.addColorStop(1, stage.platform.side);
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, p.w, h, h / 2);
  ctx.fill();

  const topLight = ctx.createLinearGradient(0, y, 0, y + 7);
  topLight.addColorStop(0, 'rgba(255,255,255,0.5)');
  topLight.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = topLight;
  roundRect(ctx, x + 3, y, p.w - 6, 8, 4);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = hexA(accent, 0.82);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 1);
  ctx.lineTo(x + p.w - 12, y + 1);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = hexA('#000000', 0.16);
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 20 + i * (p.w - 40) / 4, y + 6);
    ctx.lineTo(x + 20 + i * (p.w - 40) / 4, y + h - 4);
    ctx.stroke();
  }

  // hanging ornaments
  if (stage.kind === 'sky') {
    ctx.strokeStyle = 'rgba(255,210,140,0.3)';
    ctx.lineWidth = 1.5;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(p.x + s * p.w * 0.34, y + h);
      ctx.lineTo(p.x + s * p.w * 0.3, y + h + 20);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,190,100,0.65)';
      ctx.beginPath();
      ctx.moveTo(p.x + s * p.w * 0.3 - 3, y + h + 20);
      ctx.lineTo(p.x + s * p.w * 0.3 + 3, y + h + 20);
      ctx.lineTo(p.x + s * p.w * 0.3, y + h + 30);
      ctx.closePath();
      ctx.fill();
    }
  } else if (stage.kind === 'ember') {
    ctx.fillStyle = 'rgba(255,120,50,0.65)';
    for (let i = 0; i < 3; i++) {
      const lx = p.x + (i - 1) * p.w * 0.26;
      ctx.beginPath(); ctx.arc(lx, y + h + 5, 3, 0, TAU); ctx.fill();
    }
  } else {
    ctx.fillStyle = 'rgba(190,240,255,0.5)';
    for (const s of [-1, 1]) {
      const ix = p.x + s * p.w * 0.3;
      ctx.beginPath();
      ctx.moveTo(ix - 4, y + h); ctx.lineTo(ix + 4, y + h); ctx.lineTo(ix, y + h + 18);
      ctx.closePath(); ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------
// Ambient menu particles
// ---------------------------------------------------------------------------
export function drawAmbient(ctx, view, stage, time, intensity = 1) {
  const w = view.w;
  const h = view.h;
  if (stage.kind === 'ember') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 46; i++) {
      const seed = i * 131.17;
      const x = ((seed + Math.sin(time * 0.0004 + i) * 35) % w + w) % w;
      const y = h - ((seed * 1.7 + time * (0.02 + (i % 5) * 0.004)) % h);
      const a = 0.25 + 0.5 * Math.abs(Math.sin(time * 0.002 + i));
      ctx.fillStyle = `rgba(255,${120 + (i % 6) * 12},60,${a * 0.6 * intensity})`;
      ctx.beginPath(); ctx.arc(x, y, (i % 3) + 1, 0, TAU); ctx.fill();
    }
    ctx.restore();
  } else if (stage.kind === 'frost') {
    ctx.save();
    for (let i = 0; i < 56; i++) {
      const seed = i * 173.7;
      const x = ((seed + Math.sin(time * 0.0005 + i) * 30) % w + w) % w;
      const y = ((seed * 2.3 + time * (0.01 + (i % 4) * 0.003)) % h);
      ctx.fillStyle = `rgba(235,250,255,${0.15 + (i % 4) * 0.08})`;
      ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * 0.7, 0, TAU); ctx.fill();
    }
    ctx.restore();
  } else {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i++) {
      const seed = i * 211.3;
      const x = ((seed + Math.sin(time * 0.0007 + i * 2) * 45) % w + w) % w;
      const y = ((seed * 1.4 + time * (0.008 + (i % 3) * 0.003)) % h);
      ctx.fillStyle = `rgba(255,215,150,${0.08 + (i % 5) * 0.025})`;
      ctx.beginPath(); ctx.arc(x, y, 1.2 + (i % 4) * 0.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Stage preview
// ---------------------------------------------------------------------------
export function drawStageThumb(canvas, stageId) {
  const stage = STAGE_MAP[stageId];
  if (!stage) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 420;
  const h = canvas.clientHeight || 236;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const view = { w, h };
  const cam = { x: 0, y: -80, zoom: 0.9 };
  drawBackground(ctx, view, stage, cam, 1200);

  const scale = Math.min(w / 1480, h / 720) * 1.3;
  ctx.save();
  ctx.translate(w / 2, h * 0.66);
  ctx.scale(scale, scale);
  drawStage(ctx, stage, 1200, { thumb: true });

  // tiny fighters for scale
  const chars = ['blaze', 'volt'];
  chars.forEach((id, i) => {
    const char = CHAR_MAP[id];
    const fake = {
      char, charId: id, x: i ? 220 : -240, y: 0, facing: i ? -1 : 1,
      vx: 0, vy: 0, grounded: true, action: null, animTime: 50 + i * 10,
      slot: i, damage: 0, invincible: 0, respawnGlow: 0, hitFlash: 0,
      hitstun: 0, charging: false, crouching: false, landSquash: 0,
      airDodgeUsed: false, trail: [],
    };
    drawFighter(ctx, fake, 0);
  });
  ctx.restore();

  // bottom fade
  const fade = ctx.createLinearGradient(0, h * 0.7, 0, h);
  fade.addColorStop(0, 'rgba(8,7,16,0)');
  fade.addColorStop(1, 'rgba(8,7,16,0.5)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, w, h);
}
