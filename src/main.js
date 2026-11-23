// ---------------------------------------------------------------------------
// SMASH ARENA — app shell, menu flow, HUD and loop.
// ---------------------------------------------------------------------------
import {
  CHARACTERS, CHAR_MAP, STAGES, SLOT_COLORS, SLOT_NAMES, DIFFICULTIES,
  defaultConfig,
} from './data.js';
import { audio } from './audio.js';
import { InputManager } from './input.js';
import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { drawCharacterCard, drawAvatar } from './figure.js';
import { drawStageThumb } from './backdrop.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const clone = (v) => JSON.parse(JSON.stringify(v));

class App {
  constructor() {
    this.config = defaultConfig();
    this.battleConfig = null;
    this.activeSlot = 0;
    this.screen = 'title';
    this.paused = false;
    this.audioReady = false;
    this.toastTimer = 0;
    this.avatarCache = new Map();
    this.lastFrame = performance.now();
    this.acc = 0;
    this.lastHud = null;
    this.cards = new Map();

    this.canvas = $('#game');
    this.renderer = new Renderer(this.canvas);
    this.input = new InputManager();
    this.game = new Game();

    this.els = {
      hud: $('#hud'),
      screenLayer: $('#screenLayer'),
      title: $('#titleScreen'),
      select: $('#selectScreen'),
      stage: $('#stageScreen'),
      results: $('#resultsScreen'),
      pause: $('#pauseModal'),
      howto: $('#howToModal'),
      toast: $('#toast'),
      charGrid: $('#charGrid'),
      slotList: $('#slotList'),
      stageGrid: $('#stageGrid'),
      stageBlurb: $('#stageBlurb'),
      resultTable: $('#resultTable'),
      resultTitle: $('#resultTitle'),
      resultEyebrow: $('#resultEyebrow'),
      winnerStrip: $('#winnerStrip'),
    };
  }

  // -------------------------------------------------------------------------
  init() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
    this.input.attach();

    const unlock = () => {
      audio.init();
      if (!this.audioReady) {
        this.audioReady = true;
        audio.setMusic(this.screen === 'battle' ? 'battle' : 'menu');
      }
    };
    document.addEventListener('pointerdown', unlock, { once: false });
    document.addEventListener('keydown', unlock, { once: false });

    try {
      const saved = localStorage.getItem('smash-arena-sound');
      if (saved === 'off') audio.enabled = false;
    } catch { /* ignore */ }
    this.syncSound();

    this.bindEvents();
    this.renderer.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', () => {
      this.renderer.resize(window.innerWidth, window.innerHeight);
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.renderer.resize(window.innerWidth, window.innerHeight), 120);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.screen === 'battle' && !this.paused) this.setPaused(true);
    });
    window.addEventListener('gamepadconnected', (e) => {
      this.input.poll();
      this.toast(`GAMEPAD CONNECTED · P${(e.gamepad.index || 0) + 1}`, 2600);
    });

    this.showScreen('title');
    requestAnimationFrame((t) => this.frame(t));
  }

  bindEvents() {
    $('#quickPlay').addEventListener('click', () => {
      audio.init(); audio.click();
      const cfg = defaultConfig();
      cfg.stage = 'sky';
      this.startBattle(cfg);
    });
    $('#customPlay').addEventListener('click', () => {
      audio.init(); audio.click();
      this.openSelect();
    });
    $('#howToPlay').addEventListener('click', () => {
      audio.click();
      this.openHowTo();
    });
    $('#selectBack').addEventListener('click', () => { audio.click(); this.showScreen('title'); });
    $('#stageBack').addEventListener('click', () => { audio.click(); this.openSelect(); });
    $('#toStage').addEventListener('click', () => {
      audio.click();
      this.ensureValidLineup();
      this.openStage();
    });
    $('#startFight').addEventListener('click', () => {
      audio.click();
      this.ensureValidLineup();
      this.startBattle(clone(this.config));
    });
    $('#rematch').addEventListener('click', () => {
      audio.click();
      this.startBattle(clone(this.battleConfig || this.config));
    });
    $('#resultsCustom').addEventListener('click', () => {
      audio.click();
      if (this.battleConfig) this.config = clone(this.battleConfig);
      this.openSelect();
    });
    $('#resultsTitle').addEventListener('click', () => { audio.click(); this.showScreen('title'); });
    $('#resumeBtn').addEventListener('click', () => { audio.click(); this.setPaused(false); });
    $('#restartBtn').addEventListener('click', () => {
      audio.click();
      this.setPaused(false);
      this.startBattle(clone(this.battleConfig || this.config));
    });
    $('#pauseControlsBtn').addEventListener('click', () => { audio.click(); this.openHowTo(); });
    $('#quitBtn').addEventListener('click', () => {
      audio.click();
      this.setPaused(false);
      this.showScreen('title');
    });
    $('#howToClose').addEventListener('click', () => { audio.click(); this.closeHowTo(); });
    $('#soundBtn').addEventListener('click', () => {
      audio.init();
      audio.enabled = !audio.enabled;
      audio.setEnabled(audio.enabled);
      if (audio.enabled) { audio.setMusic(this.screen === 'battle' ? 'battle' : 'menu'); audio.click(); }
      try { localStorage.setItem('smash-arena-sound', audio.enabled ? 'on' : 'off'); } catch { /* ignore */ }
      this.syncSound();
      this.toast(audio.enabled ? 'SOUND ON' : 'SOUND OFF', 1400);
    });
    $('#fullscreenBtn').addEventListener('click', () => {
      audio.click();
      const el = document.documentElement;
      if (!document.fullscreenElement) {
        el.requestFullscreen?.().catch(() => this.toast('FULLSCREEN UNAVAILABLE', 1800));
      } else {
        document.exitFullscreen?.();
      }
    });

    // Character grid
    this.els.charGrid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-char]');
      if (!card) return;
      const id = card.dataset.char;
      const slot = this.config.slots[this.activeSlot];
      if (!slot) return;
      if (slot.type === 'off') slot.type = this.activeSlot === 0 ? 'human' : 'cpu';
      slot.char = id;
      audio.click();
      this.renderSelect();
      this.advanceActiveSlot();
      this.renderSlots();
    });
    this.els.slotList.addEventListener('click', (e) => {
      const typeBtn = e.target.closest('[data-type]');
      const prev = e.target.closest('[data-prev]');
      const next = e.target.closest('[data-next]');
      const row = e.target.closest('[data-slot]');
      if (typeBtn) {
        const i = Number(typeBtn.dataset.type);
        const slot = this.config.slots[i];
        slot.type = slot.type === 'human' ? 'cpu' : slot.type === 'cpu' ? 'off' : 'human';
        this.activeSlot = i;
        if (slot.type !== 'off' && !CHAR_MAP[slot.char]) slot.char = 'blaze';
        audio.click();
        this.renderSelect();
        return;
      }
      if (prev || next) {
        const i = Number((prev || next).dataset.prev || (prev || next).dataset.next);
        const slot = this.config.slots[i];
        const idx = CHARACTERS.findIndex((c) => c.id === slot.char);
        const delta = next ? 1 : -1;
        slot.char = CHARACTERS[(idx + delta + CHARACTERS.length) % CHARACTERS.length].id;
        if (slot.type === 'off') slot.type = i === 0 ? 'human' : 'cpu';
        this.activeSlot = i;
        audio.hover();
        this.renderSelect();
        return;
      }
      if (row) {
        this.activeSlot = Number(row.dataset.slot);
        audio.hover();
        this.renderSlots();
        this.renderSelect(true);
      }
    });

    // CPU picker
    $('#cpuLevelPicker').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-level]');
      if (!btn) return;
      this.config.difficulty = Number(btn.dataset.level);
      audio.click();
      this.syncSegments();
      this.renderSlots();
    });

    // Stocks
    $('#stockPicker').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-stocks]');
      if (!btn) return;
      this.config.stocks = Number(btn.dataset.stocks);
      audio.click();
      this.syncSegments();
      this.renderStageScreen(true);
    });

    // Stages
    this.els.stageGrid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-stage]');
      if (!card) return;
      this.config.stage = card.dataset.stage;
      audio.click();
      this.renderStageScreen();
    });

    // Global keys
    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Escape') {
        if (!this.els.howto.classList.contains('hidden')) { this.closeHowTo(); e.preventDefault(); return; }
        if (this.screen === 'battle') { this.setPaused(!this.paused); e.preventDefault(); return; }
        if (this.screen === 'results') { this.showScreen('title'); e.preventDefault(); return; }
        if (this.screen === 'stage') { this.openSelect(); e.preventDefault(); return; }
        if (this.screen === 'select') { this.showScreen('title'); e.preventDefault(); return; }
      }
      if (e.code === 'Enter' && this.screen === 'title' && !(e.target instanceof HTMLButtonElement)) {
        $('#quickPlay').click();
      }
    });
  }

  syncSound() {
    const btn = $('#soundBtn');
    if (!btn) return;
    btn.classList.toggle('off', !audio.enabled);
    btn.innerHTML = `SOUND <b>${audio.enabled ? 'ON' : 'OFF'}</b>`;
    btn.setAttribute('aria-label', audio.enabled ? 'Mute audio' : 'Enable audio');
  }

  syncSegments() {
    $$('#cpuLevelPicker [data-level]').forEach((b) => b.classList.toggle('on', Number(b.dataset.level) === this.config.difficulty));
    $$('#stockPicker [data-stocks]').forEach((b) => b.classList.toggle('on', Number(b.dataset.stocks) === this.config.stocks));
  }

  toast(message, ms = 2200) {
    const el = this.els.toast;
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  // -------------------------------------------------------------------------
  showScreen(name) {
    this.screen = name;
    this.input.releaseAll();
    this.els.title.classList.toggle('hidden', name !== 'title');
    this.els.select.classList.toggle('hidden', name !== 'select');
    this.els.stage.classList.toggle('hidden', name !== 'stage');
    this.els.results.classList.toggle('hidden', name !== 'results');
    this.els.hud.classList.toggle('active', name === 'battle');
    if (name !== 'battle') {
      this.els.pause.classList.add('hidden');
      this.els.howto.classList.add('hidden');
    }
    if (name === 'title') {
      this.paused = false;
      this.cards.clear();
      this.els.hud.innerHTML = '';
      audio.setMusic('menu');
    } else if (name === 'select') {
      audio.setMusic('menu');
      this.renderSelect();
    } else if (name === 'stage') {
      audio.setMusic('menu');
      this.renderStageScreen();
    } else if (name === 'battle') {
      audio.setMusic('battle');
    } else if (name === 'results') {
      audio.setMusic('menu');
    }
  }

  // -------------------------------------------------------------------------
  openSelect() {
    this.config = clone(this.config);
    if (!this.config.slots.some((s) => s.type !== 'off')) {
      this.config.slots[0] = { type: 'human', char: this.config.slots[0]?.char || 'blaze' };
    }
    this.activeSlot = Math.max(0, this.config.slots.findIndex((s) => s.type !== 'off'));
    this.showScreen('select');
    this.renderSelect();
    this.syncSegments();
  }

  openStage() {
    this.showScreen('stage');
    this.renderStageScreen();
    this.syncSegments();
  }

  ensureValidLineup() {
    const active = this.config.slots.filter((s) => s.type !== 'off');
    if (active.length === 0) {
      this.config.slots[0] = { type: 'human', char: 'blaze' };
      this.config.slots[1] = { type: 'cpu', char: 'volt' };
      this.toast('ADDED TWO FIGHTERS', 1800);
    } else if (active.length === 1) {
      const free = this.config.slots.find((s) => s.type === 'off');
      if (free) {
        free.type = 'cpu';
        free.char = free.char || 'volt';
        this.toast('RIVAL ADDED · CPU', 1600);
      }
    }
    for (const slot of this.config.slots) {
      if (slot.type !== 'off' && !CHAR_MAP[slot.char]) slot.char = 'blaze';
    }
  }

  advanceActiveSlot() {
    const slots = this.config.slots;
    for (let step = 1; step <= slots.length; step++) {
      const i = (this.activeSlot + step) % slots.length;
      if (slots[i].type !== 'off') {
        this.activeSlot = i;
        this.renderSlots();
        return;
      }
    }
    this.renderSlots();
  }

  setActiveSlot(i) {
    this.activeSlot = i;
    this.renderSlots();
  }

  // -------------------------------------------------------------------------
  renderSelect(soft = false) {
    const grid = this.els.charGrid;
    if (!grid) return;
    grid.innerHTML = CHARACTERS.map((c) => {
      const assigned = this.config.slots
        .map((s, i) => ({ ...s, i }))
        .filter((s) => s.type !== 'off' && s.char === c.id)
        .map((s) => `<span>${SLOT_NAMES[s.i]}</span>`)
        .join('');
      const active = this.config.slots.some((s) => s.type !== 'off' && s.char === c.id);
      return `
      <button class="char-card ${active ? 'selected' : ''}" data-char="${c.id}" style="--accent:${c.palette.ui[0]};--accent2:${c.palette.ui[1]}" aria-label="Select ${c.name}">
        <div class="portrait">
          <span class="slotbadge">${c.num}</span>
          <canvas data-preview="${c.id}"></canvas>
        </div>
        <div class="info">
          <div class="idx">FIGHTER ${c.num}</div>
          <h3 class="cname">${c.name}</h3>
          <p class="ctitle">${c.title}</p>
          <div class="stat-bars">
            ${this.statBar('POWER', c.stats.power, c)}
            ${this.statBar('SPEED', c.stats.speed, c)}
            ${this.statBar('WEIGHT', c.stats.weight, c)}
          </div>
          <div class="specialline">SPECIAL · <b>${c.specialName}</b></div>
        </div>
        <div class="assigned">${assigned}</div>
      </button>`;
    }).join('');
    requestAnimationFrame(() => {
      $$('canvas[data-preview]').forEach((cv) => drawCharacterCard(cv, cv.dataset.preview));
    });
    this.renderSlots();
    this.syncSegments();
  }

  statBar(label, value, c) {
    return `<div class="statline"><span>${label}</span><span class="track"><i style="width:${value * 10}%;--accent:${c.palette.ui[0]};--accent2:${c.palette.ui[1]}"></i></span></div>`;
  }

  renderSlots() {
    if (!this.els.slotList) return;
    this.els.slotList.innerHTML = this.config.slots.map((slot, i) => {
      const char = CHAR_MAP[slot.char] || CHARACTERS[0];
      const typeLabel = slot.type === 'human' ? 'YOU' : slot.type === 'cpu' ? 'CPU' : 'OFF';
      const sub = slot.type === 'off' ? 'EMPTY SLOT' : slot.type === 'human' ? 'LOCAL PLAYER' : `CPU · ${DIFFICULTIES.find((d) => d.id === this.config.difficulty)?.label || 'NORMAL'}`;
      return `
      <div class="slot-row ${i === this.activeSlot ? 'active' : ''} ${slot.type === 'off' ? 'off' : ''}" data-slot="${i}" style="--accent:${SLOT_COLORS[i]}">
        <div class="slot-avatar"><canvas data-slot-avatar="${i}"></canvas></div>
        <div class="slot-meta">
          <div class="slot-tag">${SLOT_NAMES[i]} <span style="opacity:.65">·</span> ${sub}</div>
          <div class="slot-char">${slot.type === 'off' ? '—' : char.name}</div>
        </div>
        <div class="slot-controls">
          <button class="mini-btn" data-prev="${i}" aria-label="Previous fighter for ${SLOT_NAMES[i]}">‹</button>
          <button class="type-toggle ${slot.type}" data-type="${i}" aria-label="Toggle player type for ${SLOT_NAMES[i]}">${typeLabel}</button>
          <button class="mini-btn" data-next="${i}" aria-label="Next fighter for ${SLOT_NAMES[i]}">›</button>
        </div>
      </div>`;
    }).join('');
    requestAnimationFrame(() => {
      $$('canvas[data-slot-avatar]').forEach((cv) => {
        const i = Number(cv.dataset.slotAvatar);
        const slot = this.config.slots[i];
        if (slot.type === 'off') return;
        drawAvatar(cv, slot.char);
      });
    });
  }

  // -------------------------------------------------------------------------
  openStage() {
    this.ensureValidLineup();
    this.showScreen('stage');
    this.renderStageScreen();
    this.syncSegments();
  }

  renderStageScreen(soft = false) {
    const grid = this.els.stageGrid;
    if (!grid) return;
    grid.innerHTML = STAGES.map((s) => `
      <button class="stage-card ${this.config.stage === s.id ? 'selected' : ''}" data-stage="${s.id}" style="--accent:${s.accent}" aria-label="Choose ${s.name}">
        <div class="stage-thumb">
          <canvas data-stage-thumb="${s.id}"></canvas>
          <span class="tag">${s.tag}</span>
          <span class="pick-mark">✓</span>
        </div>
        <div class="stage-info">
          <h3>${s.name}</h3>
          <p>${s.desc}</p>
        </div>
      </button>`).join('');
    requestAnimationFrame(() => {
      $$('canvas[data-stage-thumb]').forEach((cv) => drawStageThumb(cv, cv.dataset.stageThumb));
    });
    const stage = STAGES.find((s) => s.id === this.config.stage) || STAGES[0];
    if (this.els.stageBlurb) {
      this.els.stageBlurb.innerHTML = `<b>${stage.name}</b><span>${stage.short} · ${this.config.stocks} stock${this.config.stocks > 1 ? 's' : ''} · CPU ${DIFFICULTIES.find((d) => d.id === this.config.difficulty)?.label || 'NORMAL'}</span>`;
    }
    this.syncSegments();
  }

  // -------------------------------------------------------------------------
  startBattle(config) {
    this.config = clone(config);
    this.ensureValidLineup();
    if (!this.config.slots.some((s) => s.type === 'human')) {
      // always give the first slot to the player if every slot is CPU
      this.config.slots[0].type = 'human';
    }
    this.battleConfig = clone(this.config);
    this.paused = false;
    this.els.pause.classList.add('hidden');
    this.els.howto.classList.add('hidden');
    this.showScreen('battle');
    this.game.start(this.config, (results) => this.showResults(results));
    this.buildHud();
    this.lastHud = null;
    audio.init();
    audio.setMusic('battle');
    const human = this.config.slots
      .map((s, i) => (s.type === 'human' ? (i === 0 ? 'P1 WASD + F/G/H/SHIFT' : i === 1 ? 'P2 ARROWS + , . / \'' : `P${i + 1} READY`) : null))
      .filter(Boolean)
      .join(' · ');
    this.toast(human || 'SPECTATOR MODE', 3200);
  }

  // -------------------------------------------------------------------------
  avatarURL(charId) {
    if (this.avatarCache.has(charId)) return this.avatarCache.get(charId);
    const c = document.createElement('canvas');
    c.width = 80; c.height = 80;
    drawAvatar(c, charId);
    const url = c.toDataURL('image/png');
    this.avatarCache.set(charId, url);
    return url;
  }

  buildHud() {
    const hud = this.els.hud;
    const fighters = this.game.fighters;
    const cards = fighters.map((f) => `
      <div class="hud-card" data-slot="${f.slot}" style="--accent:${f.color}">
        <div class="hud-portrait"><img src="${this.avatarURL(f.charId)}" alt="" /></div>
        <div class="hud-ident">
          <div class="hud-player">${f.tag} <span class="tag">${f.kind === 'cpu' ? `CPU ${DIFFICULTIES.find((d) => d.id === f.difficulty)?.label || ''}` : 'YOU'}</span></div>
          <div class="hud-name">${f.char.name}</div>
          <div class="hud-stocks">${'<span class="stock-pip"></span>'.repeat(this.config.stocks)}</div>
        </div>
        <div class="hud-dmg">0<small>%</small></div>
        <div class="hud-shield"><i></i></div>
      </div>`).join('');
    hud.innerHTML = `
      <div class="hud-topline"><span class="dot"></span>${this.game.stage.name} <span class="dot"></span> STOCK <span class="dot"></span> <span class="time">0:00</span></div>
      <div class="hud-cards">${cards}</div>
      <div class="hud-tagline"><span>ESC PAUSE</span><span>${fighters.length} FIGHTERS</span></div>`;
    this.cards.clear();
    for (const f of fighters) {
      const root = hud.querySelector(`.hud-card[data-slot="${f.slot}"]`);
      this.cards.set(f.slot, {
        root,
        dmg: root.querySelector('.hud-dmg'),
        stocks: Array.from(root.querySelectorAll('.stock-pip')),
        shield: root.querySelector('.hud-shield i'),
        time: hud.querySelector('.time'),
        lastStocks: f.stocks,
        lastDamage: -1,
      });
    }
    this.lastHud = hud.querySelector('.time');
  }

  updateHud() {
    if (!this.cards.size) return;
    for (const f of this.game.fighters) {
      const c = this.cards.get(f.slot);
      if (!c) continue;
      const rounded = Math.round(f.damage);
      if (rounded !== c.lastDamage) {
        c.dmg.innerHTML = `${rounded}<small>%</small>`;
        c.root.classList.toggle('low', rounded >= 50 && rounded < 100);
        c.root.classList.toggle('mid', rounded >= 100 && rounded < 150);
        c.root.classList.toggle('high', rounded >= 150);
        c.root.classList.toggle('danger', rounded >= 200);
        c.lastDamage = rounded;
      }
      if (f.stocks !== c.lastStocks) {
        c.stocks.forEach((pip, i) => pip.classList.toggle('lost', i >= f.stocks));
        c.root.classList.toggle('koed', f.stocks <= 0);
        c.lastStocks = f.stocks;
      }
      c.root.classList.toggle('shielding', f.action === 'shield');
      c.shield.style.transform = `scaleX(${Math.max(0, f.shieldHP) / 100})`;
      c.root.classList.toggle('koed', f.stocks <= 0 || f.eliminated);
    }
    if (this.lastHud) this.lastHud.textContent = this.game.formatTime();
  }

  // -------------------------------------------------------------------------
  showResults(results) {
    const winner = results.winner;
    const anyHuman = results.rows.some((r) => r.kind === 'human');
    let title = 'DRAW';
    if (winner) title = winner.kind === 'human' ? 'VICTORY' : anyHuman ? 'DEFEAT' : 'CPU WINS';
    this.els.resultTitle.textContent = title;
    this.els.resultEyebrow.textContent = `MATCH COMPLETE · ${Math.floor(results.duration / 60 / 60)}:${String(Math.floor(results.duration / 60) % 60).padStart(2, '0')} · ${results.stage.name}`;
    this.els.resultTable.innerHTML = results.rows.map((r) => `
      <div class="result-row ${r.placement === 1 ? 'winner' : ''}" style="--accent:${r.color}">
        <div class="place">${r.placement}</div>
        <div class="ra-avatar"><canvas data-result-avatar="${r.charId}"></canvas></div>
        <div class="ra-name">${r.charName}<small>${r.tag} · ${r.kind === 'cpu' ? 'CPU' : 'PLAYER'}</small></div>
        <div class="stat">${r.kos}<small>KOs</small></div>
        <div class="stat">${r.falls}<small>FALLS</small></div>
        <div class="stat">${Math.round(r.dealt)}<small>DAMAGE</small></div>
      </div>`).join('');
    const winChar = winner ? CHAR_MAP[winner.charId] : null;
    this.els.winnerStrip.innerHTML = winner
      ? `<div class="win-avatar"><canvas data-winner-avatar="${winner.charId}"></canvas></div><span>${winner.tag} · ${winner.charName} TAKES THE ARENA</span>`
      : '<span>NO CONTEST · EVERYONE BLASTED OUT</span>';
    requestAnimationFrame(() => {
      $$('canvas[data-result-avatar]').forEach((cv) => drawAvatar(cv, cv.dataset.resultAvatar));
      const wc = document.querySelector('canvas[data-winner-avatar]');
      if (wc) drawAvatar(wc, wc.dataset.winnerAvatar);
    });
    this.paused = true;
    this.els.hud.classList.remove('active');
    this.showScreen('results');
    this.els.hud.classList.remove('active');
    if (winChar && winner.kind === 'human') audio.win();
  }

  // -------------------------------------------------------------------------
  setPaused(paused) {
    if (this.screen !== 'battle') return;
    if (paused === this.paused) return;
    this.paused = paused;
    this.els.pause.classList.toggle('hidden', !paused);
    if (paused) {
      this.input.releaseAll();
      this.els.howto.classList.add('hidden');
    } else {
      this.input.releaseAll();
      this.els.howto.classList.add('hidden');
    }
  }

  openHowTo() {
    this.els.howto.classList.remove('hidden');
    this.input.releaseAll();
  }

  closeHowTo() {
    this.els.howto.classList.add('hidden');
    audio.click();
  }

  // -------------------------------------------------------------------------
  tick() {
    this.input.poll();
    if (this.screen === 'battle') {
      if (this.input.pausePressed()) {
        this.setPaused(!this.paused);
        return;
      }
      if (this.paused) return;
      const inputs = [];
      for (const f of this.game.fighters) {
        if (f.kind === 'human') inputs[f.slot] = this.input.stateFor(f.slot);
      }
      this.game.update(inputs);
      this.updateHud();
      if (this.game.phase === 'ended') {
        // results are delivered by the game callback
      }
    }
  }

  frame(now) {
    const delta = Math.min(100, now - this.lastFrame);
    this.lastFrame = now;
    this.acc += delta;
    const step = 1000 / 60;
    let iterations = 0;
    while (this.acc >= step && iterations < 5) {
      this.tick();
      this.acc -= step;
      iterations++;
    }
    if (this.acc > step * 5) this.acc = 0;

    if (this.screen === 'battle' || this.screen === 'results') {
      this.renderer.renderGame(this.game, now);
    } else {
      this.renderer.renderMenu(this.config.stage, now, this.screen === 'title' ? 'title' : 'menu');
    }
    requestAnimationFrame((t) => this.frame(t));
  }
}

const app = new App();
window.__arena = app;
app.init();
