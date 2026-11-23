# Tester002

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Remixed using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/TonyD2F/Tester002)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/TonyD2F/Tester002)

- 🎮 [Open the project](https://go.ondev.store/TonyD2F/Tester002).
- ✨ [Remix this project](https://go.ondev.store/TonyD2F/Tester002?remix=1).
- 💻 [Explore the source](https://github.com/TonyD2F/Tester002).
- 🛠️ [Check build runs](https://github.com/TonyD2F/Tester002/actions).
- 🐛 [Report an issue](https://github.com/TonyD2F/Tester002/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/TonyD2F).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
- 🧬 [Explore the remix source](https://github.com/TonyD2F/Tester002).
<!-- omgithub:readme:end -->

## SMASH ARENA

A complete, fully offline platform fighter in the spirit of Super Smash Bros. Four fighters, three stages, local multiplayer against friends or CPUs, stock battles, shields, dodges, projectiles, and a synthesized soundtrack. Every sprite, stage, effect, and sound is generated at runtime — no external assets, no network connection, no install.

### Run it

Any static file server works:

```bash
python3 -m http.server 3000
# open http://localhost:3000
```

The bundled `./start.sh` starts the project with the OMGithub preview runtime when available. The game also runs directly from `index.html` in a browser that permits ES modules from `file://`; a local server is recommended.

### Modes

- **Quick Play** — a 1v1 match against a CPU on Sky Sanctum.
- **Custom Match** — up to four fighters (human or CPU), 1–5 stocks, three stages, and three CPU levels (Rookie, Normal, Ace).
- **Local multiplayer** — P1 and P2 use one keyboard, P3/P4 use additional keys, and connected gamepads control their matching P1–P4 slot.
- **Full loop** — title, fighter select, stage select, battle, pause, rematch, results, and a controls manual.

### Controls

| Action | Player 1 | Player 2 | Player 3 | Player 4 |
| --- | --- | --- | --- | --- |
| Move / jump | `WASD` | Arrow keys | `IJKL` | Numpad `8456` |
| Attack / charge | `F` | `,` | `U` | Numpad `7` |
| Special | `G` | `.` | `O` | Numpad `9` |
| Shield | `H` | `/` | `P` | Numpad `0` |
| Dodge | `Shift` | `'` | `;` | Numpad `1` |

- **Smash attacks** — hold a direction + attack while grounded to charge; release to launch.
- **Specials** — neutral, side, up, and down each behave differently. Up special is the recovery move.
- **Gamepad** — stick/D-pad to move, A jump, X attack, B special, shoulder buttons to shield/dodge, Start to pause.
- **Touch** — on phones and tablets an on-screen D-pad and action buttons appear automatically during a battle. They control the first human slot. Enable or disable them any time with **Touch Controls** in the pause menu; the choice is remembered. Tap the ❚❚ button to pause.
- **Pause** — `Esc` during a battle, or the pause button on screen.
- **Damage %** rises as you take hits; higher damage means stronger knockback.
- **Stocks** are lost when you cross a blast zone. Last fighter standing wins.

### Tech

Plain HTML, CSS, and ES modules. Rendering uses the Canvas 2D API (`src/renderer.js`, `src/figure.js`, `src/backdrop.js`), combat and physics live in `src/fighter.js` and `src/game.js`, CPU behavior in `src/ai.js`, input in `src/input.js`, and music/SFX are synthesized with the Web Audio API in `src/audio.js`. No build step required.
