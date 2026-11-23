// ---------------------------------------------------------------------------
// Renderer — composes backdrop, stage, fighters, effects and banners.
// ---------------------------------------------------------------------------
import { CHAR_MAP, STAGE_MAP } from './data.js';
import {
  TAU, clamp, hexA, mix, roundRect, poly, starPath, glowCircle,
} from './draw-utils.js';
import { drawBackground, drawStage, drawAmbient } from './backdrop.js';
import { drawFighter, drawFighterShadow } from './figure.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.view = { w: 1280, h: 720 };
    this.dpr = 1;
    this.menuFighters = null;
    this.menuStageId = null;
  }

  resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.view = { w: Math.max(320, w), h: Math.max(240, h) };
    this.canvas.width = Math.round(this.view.w * dpr);
    this.canvas.height = Math.round(this.view.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
  }

  // -------------------------------------------------------------------------
  renderGame(game, time) {
    const ctx = this.ctx;
    const { w, h } = this.view;
    ctx.clearRect(0, 0, w, h);
    if (!game.initialized) {
      this.renderMenu(game.stage.id, time, 'title');
      return;
    }

    const cam = game.camera;
    drawBackground(ctx, this.view, game.stage, cam, time);

    const base = h / 720;
    const scale = base * cam.zoom * (1 + (cam.punch || 0));
    const shakeX = game.shake > 0.2 ? (Math.random() * 2 - 1) * game.shake : 0;
    const shakeY = game.shake > 0.2 ? (Math.random() * 2 - 1) * game.shake : 0;
    const originX = w / 2 + shakeX;
    const originY = h * 0.60 + shakeY;

    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(scale, scale);
    ctx.translate(-cam.x, -cam.y);

    drawStage(ctx, game.stage, time);

    // shadows
    for (const f of game.fighters) {
      if (f.invisible) continue;
      const ground = this.groundUnder(f, game.stage);
      if (ground !== null) drawFighterShadow(ctx, f, ground);
    }

    // entities sorted by feet / y position
    const entities = [];
    for (const p of game.projectiles) entities.push({ y: p.y, kind: 'proj', p });
    for (const f of game.fighters) {
      if (!f.invisible) entities.push({ y: f.y, kind: 'fighter', f });
    }
    entities.sort((a, b) => a.y - b.y);

    for (const e of entities) {
      if (e.kind === 'fighter') {
        this.drawRespawnHalo(ctx, e.f, time);
        drawFighter(ctx, e.f, time);
        this.drawPlayerRing(ctx, e.f, time);
      } else {
        this.drawProjectile(ctx, e.p, time);
      }
    }

    this.drawParticles(ctx, game.particles, time);
    this.drawPopups(ctx, game.popups);
    ctx.restore();

    // screen-space ambience
    drawAmbient(ctx, this.view, game.stage, time, 0.75);

    this.drawScreenOverlays(ctx, game, time);
    this.drawOffscreenMarkers(ctx, game, originX, originY, scale);
    this.drawAnnouncement(ctx, game, time);

    if (game.phase === 'ended') this.drawResultsBackdrop(ctx);
  }

  // -------------------------------------------------------------------------
  renderMenu(stageId, time, mode = 'title') {
    const ctx = this.ctx;
    const { w, h } = this.view;
    const stage = STAGE_MAP[stageId] || STAGE_MAP.sky;
    ctx.clearRect(0, 0, w, h);
    const cam = { x: 0, y: -95, zoom: 0.9 };
    drawBackground(ctx, this.view, stage, cam, time);

    const base = h / 720;
    const scale = base * 0.93;
    const originX = w / 2;
    const originY = h * 0.64;

    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(scale, scale);
    ctx.translate(-cam.x, -cam.y);
    drawStage(ctx, stage, time);
    if (mode === 'title') {
      const fs = this.getMenuFighters(stage);
      for (const f of fs) f.animTime = (f.animTime || 0) + 1;
      const sorted = [...fs].sort((a, b) => a.y - b.y);
      for (const f of sorted) {
        if (!f.invisible) {
          const ground = this.groundUnder(f, stage);
          if (ground !== null) drawFighterShadow(ctx, f, ground);
        }
      }
      for (const f of fs) {
        drawFighter(ctx, f, time);
        this.drawPlayerRing(ctx, f, time, true);
      }
    } else {
      // quieter scene for menu screens: two silhouetted fighters far apart
      const fs = this.getMenuFighters(stage).slice(0, 2);
      for (const f of fs) f.animTime = (f.animTime || 0) + 1;
      for (const f of fs) {
        const ground = this.groundUnder(f, stage);
        if (ground !== null) drawFighterShadow(ctx, f, ground);
      }
      for (const f of fs) drawFighter(ctx, f, time, { fade: 0.6 });
    }
    ctx.restore();

    drawAmbient(ctx, this.view, stage, time, 0.55);

    const v = ctx.createRadialGradient(w * 0.5, h * 0.4, Math.min(w, h) * 0.25, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(4,3,10,0)');
    v.addColorStop(1, 'rgba(4,3,10,0.6)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);

    if (mode === 'title') {
      const top = ctx.createLinearGradient(0, 0, 0, h * 0.45);
      top.addColorStop(0, 'rgba(5,4,11,0.55)');
      top.addColorStop(1, 'rgba(5,4,11,0)');
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, w, h * 0.45);
      const bottom = ctx.createLinearGradient(0, h * 0.55, 0, h);
      bottom.addColorStop(0, 'rgba(5,4,11,0)');
      bottom.addColorStop(1, 'rgba(5,4,11,0.85)');
      ctx.fillStyle = bottom;
      ctx.fillRect(0, h * 0.55, w, h * 0.45);
    }
  }

  getMenuFighters(stage) {
    if (this.menuFighters && this.menuStageId === stage.id) return this.menuFighters;
    const ids = ['blaze', 'volt', 'glacier', 'sprout'];
    const xs = [-410, -145, 145, 410];
    this.menuFighters = ids.map((id, i) => ({
      char: CHAR_MAP[id],
      charId: id,
      x: xs[i],
      y: 0,
      facing: xs[i] < 0 ? 1 : -1,
      vx: 0,
      vy: 0,
      grounded: true,
      action: null,
      move: null,
      animTime: 60 + i * 33,
      slot: i,
      color: CHAR_MAP[id].palette.ui[0],
      damage: 0,
      invincible: 0,
      respawnGlow: 0,
      hitFlash: 0,
      hitstun: 0,
      charging: false,
      crouching: false,
      landSquash: 0,
      airDodgeUsed: false,
      trail: [],
      dodgeTimer: 0,
    }));
    this.menuStageId = stage.id;
    return this.menuFighters;
  }

  groundUnder(f, stage) {
    let best = null;
    for (const p of stage.platforms) {
      const half = p.w / 2;
      if (f.x < p.x - half || f.x > p.x + half) continue;
      if (p.y < f.y - 2) continue;
      const d = p.y - f.y;
      if (d > 700) continue;
      if (best === null || p.y < best) best = p.y;
    }
    return best;
  }

  // -------------------------------------------------------------------------
  drawPlayerRing(ctx, f, time, menu = false) {
    if (!f.char || f.kind === 'cpu' && menu) return;
    const color = f.color || '#ff7a3d';
    const y = 1.5;
    ctx.save();
    ctx.globalAlpha = menu ? 0.45 : 0.7;
    ctx.strokeStyle = hexA(color, 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(f.x, y, 24 * (f.char.physics.size || 1), 6, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  drawRespawnHalo(ctx, f, time) {
    if (!f.respawnGlow || f.respawnGlow <= 0) return;
    const a = Math.min(1, f.respawnGlow / 60);
    ctx.save();
    ctx.globalAlpha = a;
    glowCircle(ctx, f.x, f.y - 45, 70, f.color, 0.28);
    ctx.strokeStyle = hexA(f.color, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 1, 34 + Math.sin(time * 0.1) * 4, 9, 0, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const ang = time * 0.04 + (i * TAU) / 3;
      ctx.beginPath();
      ctx.arc(f.x + Math.cos(ang) * 34, f.y - 45 + Math.sin(ang) * 16, 2.2, 0, TAU);
      ctx.fillStyle = f.color;
      ctx.fill();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  drawProjectile(ctx, p, time) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalCompositeOperation = 'lighter';
    if (p.kind === 'fireball') {
      glowCircle(ctx, 0, 0, p.r * 2.6, p.color, 0.4);
      const tail = -Math.sign(p.vx || 1) * 18;
      ctx.fillStyle = hexA('#ff7a3d', 0.35);
      ctx.beginPath();
      ctx.ellipse(tail, 0, 18, 7, 0, 0, TAU);
      ctx.fill();
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, p.r);
      g.addColorStop(0, '#fff8d8');
      g.addColorStop(0.45, '#ffc857');
      g.addColorStop(1, '#ff4d3d');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(-2, -2, p.r * 0.3, 0, TAU); ctx.fill();
    } else if (p.kind === 'bolt') {
      glowCircle(ctx, 0, 0, p.r * 3.2, p.color, 0.45);
      ctx.strokeStyle = '#e8feff';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-Math.sign(p.vx || 1) * 14, -3);
      ctx.lineTo(-4, 5); ctx.lineTo(0, -5); ctx.lineTo(6, 3); ctx.lineTo(12, -2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, p.r * 0.55, 0, TAU); ctx.fill();
    } else if (p.kind === 'ice') {
      glowCircle(ctx, 0, 0, p.r * 2.6, p.color, 0.35);
      ctx.rotate(p.rot || 0);
      ctx.fillStyle = '#dffaff';
      poly(ctx, [[0, -p.r * 1.6], [p.r * 0.85, 0], [0, p.r * 1.4], [-p.r * 0.85, 0]]);
      ctx.fill();
      ctx.strokeStyle = hexA('#ffffff', 0.8);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(120,220,255,0.5)';
      poly(ctx, [[0, -p.r], [p.r * 0.45, 0], [0, p.r * 0.5], [-p.r * 0.45, 0]]);
      ctx.fill();
    } else {
      // seed
      glowCircle(ctx, 0, 0, p.r * 2.2, p.color, 0.3);
      ctx.rotate(p.rot || 0);
      ctx.fillStyle = '#7d5a32';
      ctx.beginPath(); ctx.ellipse(0, 0, p.r * 0.95, p.r * 1.1, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4f9d3f';
      ctx.beginPath(); ctx.ellipse(p.r * 0.6, -p.r * 0.6, p.r * 0.9, p.r * 0.4, -0.7, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(-1, -1, p.r * 0.5, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  drawParticles(ctx, particles, time) {
    ctx.save();
    for (const p of particles) {
      const life = clamp(p.life / (p.maxLife || 1), 0, 1);
      if (p.type === 'spark') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = life;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * life);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2.4, p.y - p.vy * 2.4);
        ctx.stroke();
      } else if (p.type === 'star') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = life;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        starPath(ctx, p.size * 2.2 * (0.5 + life * 0.5), p.size * 0.6, 4);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'dust') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = life * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, p.size * (0.6 + (1 - life) * 0.7)), 0, TAU);
        ctx.fill();
      } else if (p.type === 'ring') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = life * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, 5 * life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.stroke();
      } else if (p.type === 'slash') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = life;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 + life * 5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.7 + (1 - life) * 0.5), p.rot - 0.8, p.rot + 0.8);
        ctx.stroke();
      } else if (p.type === 'beam') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = life * 0.9;
        const w = p.size * (0.5 + (1 - life) * 0.8);
        const g = ctx.createLinearGradient(p.x - p.size, p.y, p.x + p.size, p.y);
        g.addColorStop(0, hexA(p.color, 0));
        g.addColorStop(0.5, hexA(p.color, 0.75));
        g.addColorStop(1, hexA(p.color, 0));
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillRect(-p.size, -w / 2, p.size * 2, w);
        ctx.restore();
      } else if (p.type === 'trail') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = life * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * life, 0, TAU); ctx.fill();
      } else if (p.type === 'charge') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = life;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
      } else if (p.type === 'ghost') {
        const char = CHAR_MAP[p.char];
        if (!char) continue;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = life * 0.22;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.facing || 1, 1);
        ctx.beginPath();
        ctx.ellipse(0, -36, 17, 27, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath(); ctx.arc(1, -78, 15, 0, TAU); ctx.fill();
        ctx.restore();
      } else if (p.type === 'confetti') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = Math.min(1, life * 2);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawPopups(ctx, popups) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of popups) {
      const t = p.life / p.maxLife;
      const age = 1 - t;
      const scale = (0.55 + Math.min(0.45, age * 2.2)) * p.scale;
      const alpha = t > 0.35 ? 1 : t / 0.35;
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${Math.round(20 * scale)}px "Arial Black", Impact, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(16,8,24,0.85)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  drawScreenOverlays(ctx, game, time) {
    const { w, h } = this.view;
    // top + bottom gradient for HUD legibility
    const top = ctx.createLinearGradient(0, 0, 0, Math.min(190, h * 0.26));
    top.addColorStop(0, 'rgba(5,4,11,0.55)');
    top.addColorStop(1, 'rgba(5,4,11,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, Math.min(190, h * 0.26));

    const bottom = ctx.createLinearGradient(0, h * 0.78, 0, h);
    bottom.addColorStop(0, 'rgba(5,4,11,0)');
    bottom.addColorStop(1, 'rgba(5,4,11,0.45)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);

    const vig = ctx.createRadialGradient(w * 0.5, h * 0.52, Math.min(w, h) * 0.32, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    if (game.screenFlash > 0.01) {
      ctx.fillStyle = hexA(game.flashColor || '#ffffff', Math.min(0.7, game.screenFlash));
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawOffscreenMarkers(ctx, game, originX, originY, scale) {
    if (game.phase === 'ended') return;
    const { w, h } = this.view;
    for (const f of game.fighters) {
      if (!f.alive || f.koTimer > 0) continue;
      const sx = originX + (f.x - game.camera.x) * scale;
      const sy = originY + (f.y - 55 - game.camera.y) * scale;
      if (sx > 30 && sx < w - 30 && sy > 60 && sy < h - 30) continue;
      const cx = clamp(sx, 34, w - 34);
      const cy = clamp(sy, 70, h - 40);
      const ang = Math.atan2(sy - h / 2, sx - w / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang + Math.PI / 2);
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(7, 5);
      ctx.lineTo(-7, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.fillStyle = f.color;
      ctx.font = '800 9px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.tag, cx, cy + 18);
      ctx.restore();
    }
  }

  drawAnnouncement(ctx, game, time) {
    const a = game.announcement;
    if (!a) return;
    const { w, h } = this.view;
    const t = a.life / a.maxLife;
    const age = a.maxLife - a.life;
    const intro = clamp(age / 8, 0, 1);
    const scale = (1.3 - 0.3 * intro) * (1 + Math.sin(time * 0.006) * 0.012);
    const alpha = Math.min(1, a.life / 9) * Math.min(1, age / 3 + 0.2);
    const isBig = a.text === 'GAME!' || a.text === 'KO!';
    const size = Math.min(h * (isBig ? 0.16 : 0.13), w * 0.21);
    ctx.save();
    ctx.translate(w / 2, h * 0.36);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(size)}px "Arial Black", Impact, sans-serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.09;
    ctx.strokeStyle = 'rgba(10,5,16,0.9)';
    ctx.strokeText(a.text, 0, 0);
    const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, a.color || '#fff');
    g.addColorStop(1, mix(a.color || '#ff7a3d', '#4a1438', 0.55));
    ctx.fillStyle = g;
    ctx.fillText(a.text, 0, 0);
    // shine sweep
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = '#ffffff';
    ctx.save();
    ctx.beginPath();
    ctx.rect(-size * 3, -size * 0.35, size * 6, size * 0.14);
    ctx.clip();
    ctx.fillText(a.text, 0, 0);
    ctx.restore();

    if (a.sub) {
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${Math.max(11, Math.round(size * 0.17))}px "Segoe UI", system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(10,5,16,0.82)';
      ctx.strokeText(a.sub, 0, size * 0.7);
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillText(a.sub, 0, size * 0.7);
    }
    ctx.restore();
  }

  drawResultsBackdrop(ctx) {
    const { w, h } = this.view;
    ctx.fillStyle = 'rgba(5,4,10,0.3)';
    ctx.fillRect(0, 0, w, h);
  }
}
