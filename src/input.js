// ---------------------------------------------------------------------------
// Input — keyboard for up to four local players, plus automatic gamepads.
// ---------------------------------------------------------------------------
const P = (slot, ...actions) => [slot, actions];

const KEYMAP = {
  // P1 — left hand
  KeyA: P(0, 'left'), KeyD: P(0, 'right'), KeyW: P(0, 'up', 'jump'), KeyS: P(0, 'down'),
  KeyF: P(0, 'attack'), KeyG: P(0, 'special'), KeyH: P(0, 'shield'), ShiftLeft: P(0, 'dodge'),
  // P2 — arrows + punctuation
  ArrowLeft: P(1, 'left'), ArrowRight: P(1, 'right'), ArrowUp: P(1, 'up', 'jump'), ArrowDown: P(1, 'down'),
  Comma: P(1, 'attack'), Period: P(1, 'special'), Slash: P(1, 'shield'), Quote: P(1, 'dodge'),
  // P3 — right hand letters
  KeyJ: P(2, 'left'), KeyL: P(2, 'right'), KeyI: P(2, 'up', 'jump'), KeyK: P(2, 'down'),
  KeyU: P(2, 'attack'), KeyO: P(2, 'special'), KeyP: P(2, 'shield'), Semicolon: P(2, 'dodge'),
  // P4 — numpad
  Numpad4: P(3, 'left'), Numpad6: P(3, 'right'), Numpad8: P(3, 'up', 'jump'), Numpad5: P(3, 'down'),
  Numpad7: P(3, 'attack'), Numpad9: P(3, 'special'), Numpad0: P(3, 'shield'), Numpad1: P(3, 'dodge'),
};

const GAME_KEYS = new Set(Object.keys(KEYMAP));
const PREVENT = new Set([
  ...GAME_KEYS, 'Space', 'Escape', 'Enter', 'Backspace', 'Tab',
]);
const EMPTY = Object.freeze(new Set());

export class InputManager {
  constructor() {
    this.down = new Set();
    this.pending = [new Set(), new Set(), new Set(), new Set()];
    this.prev = [new Set(), new Set(), new Set(), new Set()];
    this.padPrev = [];
    this.padPausePrev = false;
    this.pads = [];
    this.keyboardEnabled = true;
    this.lastSource = null;
    this.touchSlot = 0;
    this.touchHeld = new Set();
    this.touchPending = new Set();
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = () => this.releaseAll();
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('gamepadconnected', (e) => {
      this.padPrev[e.gamepad.index] = [];
    });
  }

  _onKeyDown(e) {
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const map = KEYMAP[e.code];
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!map) return;
    if (e.repeat) return;
    const [slot, actions] = map;
    if (!this.keyboardEnabled) return;
    this.lastSource = `p${slot + 1}`;
    for (const action of actions) {
      this.down.add(`${slot}:${action}`);
      this.pending[slot].add(action);
    }
  }

  _onKeyUp(e) {
    const map = KEYMAP[e.code];
    if (!map) return;
    const [slot, actions] = map;
    for (const action of actions) this.down.delete(`${slot}:${action}`);
  }

  releaseAll() {
    this.down.clear();
    this.pending.forEach((s) => s.clear());
    this.releaseTouch();
  }

  // -------------------------------------------------------------------------
  // Optional on-screen controls. They feed the first human slot so a phone or
  // tablet can play without a keyboard or gamepad.
  setTouchSlot(slot) {
    this.touchSlot = Number.isInteger(slot) && slot >= 0 ? slot : 0;
    this.releaseTouch();
  }

  touchDown(action) {
    if (!action) return;
    if (!this.touchHeld.has(action)) this.touchPending.add(action);
    this.touchHeld.add(action);
  }

  touchUp(action) {
    if (!action) return;
    this.touchHeld.delete(action);
  }

  releaseTouch() {
    this.touchHeld.clear();
    this.touchPending.clear();
  }

  poll() {
    this.pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    return this.pads;
  }

  get padCount() { return this.pads.length; }

  stateFor(slot) {
    const held = new Set();
    const pressed = new Set();

    if (this.keyboardEnabled) {
      for (const action of ['left', 'right', 'up', 'down', 'attack', 'special', 'shield', 'dodge', 'jump']) {
        if (this.down.has(`${slot}:${action}`)) held.add(action);
      }
      for (const action of this.pending[slot]) {
        pressed.add(action);
        held.add(action);
      }
    }

    if (slot === this.touchSlot) {
      for (const action of this.touchHeld) held.add(action);
      for (const action of this.touchPending) {
        pressed.add(action);
        held.add(action);
      }
      this.touchPending.clear();
    }

    const pad = this.pads.find((p) => p.index === slot);
    if (pad) {
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      const b = pad.buttons;
      const btn = (i) => (b[i] ? b[i].value > 0.25 || b[i].pressed : false);
      if (ax < -0.38 || btn(14)) held.add('left');
      if (ax > 0.38 || btn(15)) held.add('right');
      if (ay < -0.42 || btn(12)) held.add('up');
      if (ay > 0.42 || btn(13)) held.add('down');
      if (btn(0)) held.add('jump');
      if (btn(2)) held.add('attack');
      if (btn(1)) held.add('special');
      if (btn(5) || btn(7)) held.add('shield');
      if (btn(4) || btn(6)) held.add('dodge');
      const prev = this.padPrev[slot] || [];
      for (const [i, action] of [[0, 'jump'], [2, 'attack'], [1, 'special'], [5, 'shield'], [7, 'shield'], [4, 'dodge'], [6, 'dodge']]) {
        if (btn(i) && !prev.includes(i)) pressed.add(action);
      }
      if ((ax < -0.38 || btn(14)) && !(this.padPrevAxes?.[slot]?.left)) {
        // dpad/stick direction presses are held-only; attacks use direction held
      }
      this.padPrev[slot] = [0, 1, 2, 4, 5, 6, 7].filter((i) => btn(i));
    }

    for (const action of held) {
      if (!this.prev[slot].has(action)) pressed.add(action);
    }
    this.prev[slot] = new Set(held);
    this.pending[slot].clear();

    if (!pressed.size && !held.size) {
      // still return new sets; callers only read
    }
    return { held, pressed };
  }

  pausePressed() {
    const pad = this.pads.find((p) => p.buttons && p.buttons[9] && p.buttons[9].pressed);
    const now = Boolean(pad);
    const result = now && !this.padPausePrev;
    this.padPausePrev = now;
    return result;
  }

  connectedPads() {
    return this.pads.map((p) => ({ index: p.index, id: p.id }));
  }
}

export function emptyInput() {
  return { held: EMPTY, pressed: EMPTY };
}

export function makeInput(heldArr = [], pressedArr = []) {
  return { held: new Set(heldArr), pressed: new Set(pressedArr) };
}
