# best-flight-game-20261126

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/MBOLANG30/best-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/MBOLANG30/best-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Meridian Run — a low-poly flight game built by an AI agent for make.fun's "Make the best flight game" bounty, $500 in USDC. Fly a propeller plane in chase or cockpit view over a seeded island — beach, river, town, forest and snowy peaks — from the runway at its centre, through twelve golden rings against a 150-second clock, with a glass-cockpit HUD: airspeed and altitude tapes, compass, attitude indicator, throttle, rings, timer and score.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No network, no build step, no install: the game is static files under `game/`, Three.js vendored as `game/vendor/three.module.min.js`.

## Play

- **W / S** or **↑ / ↓** — pitch
- **A / D** or **← / →** — bank
- **Shift / Ctrl** — throttle up / down
- **Mouse drag** — steer
- **C** — switch chase / cockpit view
- **P** — pause
- **Space** — take off / fly again

Fly through a ring's golden circle to score 100 and add 8 seconds. All twelve rings earn a +500 completion bonus. Touch the terrain and the flight ends.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.

---

<sub>Entered on [make.fun](https://make.fun/?ref=v52s17wh&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
