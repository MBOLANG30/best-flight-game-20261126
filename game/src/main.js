// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, crashed and course complete.
//
// ?seed=N fixes the island's random details. ?shot=start|play|ring|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_COMPLETE, EVENT_CRASH, EVENT_RING, STATUS_TIMEOUT } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_VIEW, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, VIEW_CHASE, VIEW_COCKPIT } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
// The island is built from a fixed seed (see terrain.js), so every visit
// flies the same course and every screenshot is repeatable without a seed.

const canvas = document.getElementById('game');
const hudCanvas = document.getElementById('hud');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas, hudCanvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, STEP, VIEW_CHASE, 12);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let viewMode = VIEW_CHASE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let time = 0;
  // Seconds since the last flown ring, for the gold flash the renderer draws.
  let lastRingAt = -10;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each ring.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.startEngine();
    announce('Flying. Twelve rings, one hundred and fifty seconds.');
  }

  function endFlight(nextScreen) {
    screen = nextScreen;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (nextScreen === SCREEN_COMPLETE) {
      audio.complete();
      announce(`Course complete. Score ${world.state.score}. Best ${best}.`);
    } else {
      audio.crash();
      announce(`Crashed. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_VIEW) {
      viewMode = viewMode === VIEW_CHASE ? VIEW_COCKPIT : VIEW_CHASE;
      announce(viewMode === VIEW_COCKPIT ? 'Cockpit view.' : 'Chase view.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_COMPLETE)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title scene idles on the runway: the prop turns slowly, the
      // island and the first ring waiting ahead.
      world.state.throttle = 0.12;
      world.state.speed = 10;
      return;
    }
    const events = world.step(STEP, input.command());
    audio.setThrottle(world.state.throttle, world.state.speed);
    if (events & EVENT_RING) {
      audio.ring();
      lastRingAt = time;
      announce(`Ring ${world.state.ringsHit} of 12. Score ${world.state.score}.`);
    }
    if (events & EVENT_COMPLETE) endFlight(SCREEN_COMPLETE);
    else if (events & EVENT_CRASH) endFlight(SCREEN_OVER);
    else if (world.state.status === STATUS_TIMEOUT) endFlight(SCREEN_OVER);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    time += dt;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      accumulator += dt;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, dt, viewMode, time, time - lastRingAt);
  }

  // Leaving the tab pauses a running game rather than letting the plane fly unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Meridian Run. Press Space or click to take off.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
