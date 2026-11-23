// ---------------------------------------------------------------------------
// SMASH ARENA — data model
// Every character is procedurally drawn; every stage is built from platforms.
// ---------------------------------------------------------------------------

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const TICK = 1 / 60;

export const BLAST = { left: -1320, right: 1320, top: -980, bottom: 760 };
export const GRAVITY = 0.92;
export const MAX_FALL = 16;
export const MAX_CHARGE = 56;

const hit = (x, y, r) => ({ x, y, r });

const BASE_MOVES = {
  jab: {
    label: 'Jab', anim: 'jab', startup: 3, active: 4, recovery: 9,
    damage: 5, baseKB: 9, growth: 24, angle: 34, hitbox: hit(36, -62, 18),
    hitstop: 3, sfx: 'light',
  },
  side: {
    label: 'Smash', anim: 'side', startup: 9, active: 4, recovery: 17,
    damage: 12, baseKB: 24, growth: 72, angle: 34, hitbox: hit(49, -55, 25),
    hitstop: 5, sfx: 'heavy', chargeable: true, lunge: 1.6,
  },
  up: {
    label: 'Up Smash', anim: 'up', startup: 7, active: 5, recovery: 15,
    damage: 10, baseKB: 28, growth: 78, angle: 88, hitbox: hit(12, -104, 26),
    hitstop: 5, sfx: 'heavy', chargeable: true,
  },
  down: {
    label: 'Low Sweep', anim: 'down', startup: 8, active: 4, recovery: 18,
    damage: 10, baseKB: 20, growth: 58, angle: -18, hitbox: hit(39, -18, 21),
    hitstop: 4, sfx: 'heavy', chargeable: true,
  },
  dash: {
    label: 'Dash Strike', anim: 'dash', startup: 5, active: 5, recovery: 18,
    damage: 11, baseKB: 22, growth: 65, angle: 30, hitbox: hit(42, -48, 23),
    hitstop: 5, sfx: 'heavy', lunge: 7,
  },
  nair: {
    label: 'Neutral Air', anim: 'nair', startup: 4, active: 9, recovery: 10,
    damage: 8, baseKB: 10, growth: 40, angle: 45, hitbox: hit(0, -54, 42),
    hitstop: 3, sfx: 'light',
  },
  fair: {
    label: 'Forward Air', anim: 'fair', startup: 7, active: 5, recovery: 13,
    damage: 12, baseKB: 22, growth: 68, angle: 32, hitbox: hit(40, -62, 29),
    hitstop: 5, sfx: 'heavy',
  },
  uair: {
    label: 'Up Air', anim: 'uair', startup: 5, active: 6, recovery: 11,
    damage: 10, baseKB: 16, growth: 58, angle: 84, hitbox: hit(4, -108, 28),
    hitstop: 4, sfx: 'light',
  },
  dair: {
    label: 'Down Air', anim: 'dair', startup: 8, active: 5, recovery: 16,
    damage: 13, baseKB: 16, growth: 55, angle: -72, hitbox: hit(4, -12, 25),
    hitstop: 5, sfx: 'heavy',
  },
};

const clone = (value) => JSON.parse(JSON.stringify(value));

function makeMoves(overrides = {}) {
  const moves = clone(BASE_MOVES);
  for (const [key, patch] of Object.entries(overrides)) {
    moves[key] = { ...(moves[key] || {}), ...patch };
    if (patch.hitbox) moves[key].hitbox = { ...patch.hitbox };
    if (patch.spawn) moves[key].spawn = patch.spawn;
  }
  return moves;
}

const projectile = (kind, extra = {}) => ({
  kind, ox: 30, oy: -62, speed: 9, vy: 0, gravity: 0, r: 11,
  damage: 6, baseKB: 12, growth: 36, angle: 24, life: 110,
  ...extra,
});

// ---------------------------------------------------------------------------
// Fighters
// ---------------------------------------------------------------------------
export const CHARACTERS = [
  {
    id: 'blaze', name: 'BLAZE', title: 'The Ember Fist', num: '01',
    quote: 'Pressure, patience, and one perfectly timed uppercut.',
    specialName: 'Inferno Orb',
    palette: {
      skin: '#f4b083', primary: '#f2542d', secondary: '#2b1b3d', trim: '#ffd166',
      hair: '#3a1220', glow: '#ff7a3d', accent: '#ffb347', ui: ['#ff7a3d', '#ff3d8b'],
    },
    physics: {
      runSpeed: 5.5, airSpeed: 4.5, airAccel: 0.5, jump: 15.6, doubleJump: 14.0,
      gravity: 0.92, maxFall: 15.5, weight: 1.0, traction: 0.78, size: 1.0,
    },
    hurt: { w: 34, h: 88 },
    stats: { power: 6, speed: 6, weight: 5, range: 5, air: 6 },
    moves: makeMoves({
      side: { label: 'Ember Smash', damage: 13, growth: 74 },
      up: { label: 'Flare Upper', damage: 11 },
      nspecial: {
        label: 'Inferno Orb', anim: 'cast', startup: 11, active: 1, recovery: 20,
        damage: 0, sfx: 'fire', spawn: [{ frame: 11, projectile: projectile('fireball', { speed: 9.5, r: 12, damage: 7, baseKB: 13, growth: 40, angle: 22, life: 120 }) }],
      },
      sspecial: {
        label: 'Blaze Rush', anim: 'lunge', startup: 7, active: 8, recovery: 20,
        damage: 12, baseKB: 24, growth: 64, angle: 35, hitbox: hit(30, -50, 32),
        lunge: 9.5, hitstop: 6, sfx: 'fire', trail: 'flame',
      },
      uspecial: {
        label: 'Rising Inferno', anim: 'rise', startup: 4, active: 12, recovery: 18,
        damage: 11, baseKB: 30, growth: 80, angle: 82, hitbox: hit(6, -96, 34),
        recover: { frame: 4, vy: -17.2, vx: 2.6 }, helpless: true, hitstop: 6, sfx: 'rise', trail: 'flame',
      },
      dspecial: {
        label: 'Ember Parry', anim: 'counter', startup: 4, active: 12, recovery: 22,
        counter: true, damage: 11, baseKB: 38, growth: 70, angle: 45, sfx: 'counter',
      },
    }),
  },
  {
    id: 'volt', name: 'VOLT', title: 'The Storm Runner', num: '02',
    quote: 'Blink in, strike twice, leave a trail of static.',
    specialName: 'Static Bolt',
    palette: {
      skin: '#c98b6b', primary: '#1f4b8f', secondary: '#111a33', trim: '#45e3ff',
      hair: '#0a1020', glow: '#45e3ff', accent: '#7cf5ff', ui: ['#45e3ff', '#3f7dff'],
    },
    physics: {
      runSpeed: 6.7, airSpeed: 5.1, airAccel: 0.58, jump: 16.2, doubleJump: 14.6,
      gravity: 0.88, maxFall: 15, weight: 0.86, traction: 0.84, size: 0.94,
    },
    hurt: { w: 30, h: 86 },
    stats: { power: 4, speed: 10, weight: 3, range: 4, air: 9 },
    moves: makeMoves({
      jab: { label: 'Spark Jab', damage: 4, startup: 2, recovery: 7, growth: 20 },
      dash: { label: 'Volt Dash', damage: 10, lunge: 9 },
      nspecial: {
        label: 'Static Bolt', anim: 'cast', startup: 7, active: 1, recovery: 15,
        damage: 0, sfx: 'zap', spawn: [{ frame: 7, projectile: projectile('bolt', { speed: 14.5, r: 8, damage: 4, baseKB: 8, growth: 30, angle: 28, life: 95 }) }],
      },
      sspecial: {
        label: 'Flash Step', anim: 'lunge', startup: 4, active: 8, recovery: 18,
        damage: 9, baseKB: 18, growth: 56, angle: 26, hitbox: hit(34, -52, 30),
        lunge: 13, hitstop: 5, sfx: 'zap', trail: 'static',
      },
      uspecial: {
        label: 'Storm Rise', anim: 'rise', startup: 3, active: 10, recovery: 16,
        damage: 9, baseKB: 26, growth: 74, angle: 80, hitbox: hit(2, -92, 31),
        recover: { frame: 3, vy: -19.2, vx: 1.8 }, helpless: true, hitstop: 5, sfx: 'zap', trail: 'static',
      },
      dspecial: {
        label: 'Overcharge', anim: 'counter', startup: 3, active: 10, recovery: 20,
        counter: true, damage: 10, baseKB: 34, growth: 66, angle: 50, sfx: 'counter',
      },
    }),
  },
  {
    id: 'glacier', name: 'GLACIER', title: 'The Frozen Wall', num: '03',
    quote: 'Slow to arrive. Impossible to move.',
    specialName: 'Frost Shards',
    palette: {
      skin: '#cfe9ff', primary: '#3d6b96', secondary: '#1c2c46', trim: '#a9ecff',
      hair: '#dff6ff', glow: '#7fe6ff', accent: '#b7f1ff', ui: ['#6fe3ff', '#8a6bff'],
    },
    physics: {
      runSpeed: 4.15, airSpeed: 3.55, airAccel: 0.36, jump: 14.3, doubleJump: 12.6,
      gravity: 1.03, maxFall: 16.5, weight: 1.3, traction: 0.7, size: 1.14,
    },
    hurt: { w: 44, h: 99 },
    stats: { power: 10, speed: 3, weight: 10, range: 6, air: 3 },
    moves: makeMoves({
      jab: { label: 'Ice Jab', damage: 7, startup: 4, recovery: 11 },
      side: { label: 'Glacier Smash', damage: 16, startup: 12, recovery: 20, growth: 78 },
      up: { label: 'Ice Pillar', damage: 13, startup: 9, recovery: 17 },
      down: { label: 'Frost Sweep', damage: 12, hitbox: hit(44, -16, 25) },
      dash: { label: 'Snow Plow', damage: 14, lunge: 5.5 },
      dair: { label: 'Meteor Drop', damage: 16 },
      nspecial: {
        label: 'Frost Shards', anim: 'cast', startup: 13, active: 1, recovery: 22,
        damage: 0, sfx: 'ice', spawn: [
          { frame: 13, projectile: projectile('ice', { speed: 7.4, vy: -1.8, r: 10, damage: 4, baseKB: 8, growth: 30, angle: 18, life: 120 }) },
          { frame: 15, projectile: projectile('ice', { speed: 8.2, vy: -0.4, r: 10, damage: 4, baseKB: 8, growth: 30, angle: 22, life: 120 }) },
          { frame: 17, projectile: projectile('ice', { speed: 7.8, vy: 1.6, r: 10, damage: 4, baseKB: 8, growth: 30, angle: 26, life: 120 }) },
        ],
      },
      sspecial: {
        label: 'Avalanche', anim: 'lunge', startup: 11, active: 10, recovery: 24,
        damage: 15, baseKB: 30, growth: 72, angle: 35, hitbox: hit(24, -52, 38),
        lunge: 8, armor: true, hitstop: 7, sfx: 'heavy', trail: 'ice',
      },
      uspecial: {
        label: 'Ice Geyser', anim: 'rise', startup: 6, active: 12, recovery: 20,
        damage: 14, baseKB: 32, growth: 74, angle: 86, hitbox: hit(0, -92, 40),
        recover: { frame: 6, vy: -16.2, vx: 0.4 }, helpless: true, armor: true, hitstop: 7, sfx: 'ice', trail: 'ice',
      },
      dspecial: {
        label: 'Permafrost', anim: 'counter', startup: 4, active: 14, recovery: 24,
        counter: true, damage: 13, baseKB: 40, growth: 68, angle: 42, sfx: 'ice',
      },
    }),
  },
  {
    id: 'sprout', name: 'SPROUT', title: 'The Wildcard Bloom', num: '04',
    quote: 'Float like a petal. Hit like a falling tree.',
    specialName: 'Seed Bomb',
    palette: {
      skin: '#c8f08a', primary: '#4f9d3f', secondary: '#204a2c', trim: '#ffe27a',
      hair: '#2f6b2c', glow: '#b6ff5c', accent: '#d9ff7a', ui: ['#b6ff5c', '#3ddc84'],
    },
    physics: {
      runSpeed: 5.0, airSpeed: 4.55, airAccel: 0.52, jump: 14.8, doubleJump: 15.4,
      gravity: 0.82, maxFall: 13.8, weight: 0.9, traction: 0.76, size: 0.97,
    },
    hurt: { w: 32, h: 86 },
    stats: { power: 5, speed: 7, weight: 4, range: 8, air: 8 },
    moves: makeMoves({
      side: { label: 'Vine Smash', damage: 11, hitbox: hit(54, -54, 27) },
      nair: { label: 'Petal Spin', damage: 9, hitbox: hit(0, -54, 46) },
      nspecial: {
        label: 'Seed Bomb', anim: 'cast', startup: 10, active: 1, recovery: 18,
        damage: 0, sfx: 'seed', spawn: [{ frame: 10, projectile: projectile('seed', { speed: 7.2, vy: -6.8, gravity: 0.21, r: 11, damage: 6, baseKB: 11, growth: 38, angle: 40, life: 140, bounce: 1 }) }],
      },
      sspecial: {
        label: 'Vine Lash', anim: 'lash', startup: 8, active: 8, recovery: 16,
        damage: 10, baseKB: 18, growth: 52, angle: 28, hitbox: hit(62, -55, 28),
        lunge: 6, hitstop: 5, sfx: 'whip', trail: 'leaf',
      },
      uspecial: {
        label: 'Petal Lift', anim: 'rise', startup: 4, active: 10, recovery: 14,
        damage: 7, baseKB: 20, growth: 58, angle: 80, hitbox: hit(0, -78, 32),
        recover: { frame: 4, vy: -14.4, vx: 2.2 }, float: 32, helpless: true, hitstop: 5, sfx: 'leaf', trail: 'leaf',
      },
      dspecial: {
        label: 'Bloom Guard', anim: 'counter', startup: 4, active: 12, recovery: 22,
        counter: true, damage: 10, baseKB: 34, growth: 64, angle: 48, sfx: 'counter',
      },
    }),
  },
];

export const CHAR_MAP = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------
export const STAGES = [
  {
    id: 'sky', name: 'SKY SANCTUM', tag: 'OPEN SKY', num: '01',
    desc: 'Twin cloud platforms above a wide golden ruin. Room to breathe, nowhere to hide.',
    short: 'Wide stage, two side platforms.',
    kind: 'sky', accent: '#ffb347', accent2: '#ff5c8a',
    sky: ['#090827', '#39265f', '#a24a70', '#f2835c'],
    platform: { top: '#8b78bd', top2: '#5c4a88', side: '#241d3c', edge: '#ffcf86' },
    glow: 'rgba(255, 170, 90, 0.42)',
    platforms: [
      { x: 0, y: 0, w: 1200, h: 48, main: true },
      { x: -390, y: -152, w: 272, h: 18 },
      { x: 390, y: -152, w: 272, h: 18 },
    ],
    spawns: [{ x: -240, y: 0 }, { x: 240, y: 0 }, { x: -460, y: 0 }, { x: 460, y: 0 }],
  },
  {
    id: 'ember', name: 'EMBER FOUNDRY', tag: 'MOLTEN CORE', num: '02',
    desc: 'A furnace deck suspended over the melt. Tight ledges and a high center platform.',
    short: 'Compact stage, stacked platforms.',
    kind: 'ember', accent: '#ff6b3d', accent2: '#ffd15c',
    sky: ['#100509', '#3c0e16', '#7c1f1c', '#e0552b'],
    platform: { top: '#7b4a44', top2: '#57302f', side: '#241113', edge: '#ff9a4d' },
    glow: 'rgba(255, 90, 45, 0.5)',
    platforms: [
      { x: 0, y: 0, w: 1100, h: 52, main: true },
      { x: -330, y: -142, w: 242, h: 18 },
      { x: 330, y: -142, w: 242, h: 18 },
      { x: 0, y: -270, w: 248, h: 18 },
    ],
    spawns: [{ x: -220, y: 0 }, { x: 220, y: 0 }, { x: -420, y: 0 }, { x: 420, y: 0 }],
  },
  {
    id: 'frost', name: 'FROSTPEAK', tag: 'AURORA RIDGE', num: '03',
    desc: 'A narrow ice shelf under dancing lights. The wind is cosmetic. The drop is not.',
    short: 'Narrow stage, staggered ice shelves.',
    kind: 'frost', accent: '#7fe6ff', accent2: '#a58bff',
    sky: ['#030a1a', '#0b2440', '#175066', '#4e9a9c'],
    platform: { top: '#9fd6e8', top2: '#5488a8', side: '#182a3f', edge: '#d8f6ff' },
    glow: 'rgba(120, 230, 255, 0.4)',
    platforms: [
      { x: 0, y: 0, w: 1000, h: 50, main: true },
      { x: -320, y: -160, w: 274, h: 18 },
      { x: 60, y: -258, w: 238, h: 18 },
      { x: 380, y: -122, w: 208, h: 18 },
    ],
    spawns: [{ x: -200, y: 0 }, { x: 200, y: 0 }, { x: -390, y: 0 }, { x: 390, y: 0 }],
  },
];

export const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.id, s]));

export const SLOT_COLORS = ['#ff7a3d', '#45e3ff', '#b6ff5c', '#ff5cae'];
export const SLOT_NAMES = ['P1', 'P2', 'P3', 'P4'];

export const DIFFICULTIES = [
  { id: 1, label: 'ROOKIE', reaction: 17, aggression: 0.55, defense: 0.25, recovery: 0.55 },
  { id: 2, label: 'NORMAL', reaction: 10, aggression: 0.75, defense: 0.5, recovery: 0.82 },
  { id: 3, label: 'ACE', reaction: 6, aggression: 0.92, defense: 0.78, recovery: 0.96 },
];

export function defaultConfig() {
  return {
    stocks: 3,
    difficulty: 2,
    stage: 'sky',
    slots: [
      { type: 'human', char: 'blaze' },
      { type: 'cpu', char: 'volt' },
      { type: 'off', char: 'glacier' },
      { type: 'off', char: 'sprout' },
    ],
  };
}
