// The screenshot scenes behind ?shot=start|play|ring|end. Each one plays the
// real rules forward from a fresh world for a fixed time, steered by a simple
// autopilot (bank toward the next ring, pitch to its height, throttle to
// cruise, climb when the ground ahead is high), so the frame is what a real
// flight looks like and the same seed always gives the same frame.
import { SHOT_END_LIMIT_SECONDS, SHOT_PLAY_SECONDS, STEP } from './config.js';
import { EVENT_COMPLETE, EVENT_CRASH, STATUS_COMPLETE, STATUS_CRASHED } from './world.js';
import { SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { terrainHeight } from './terrain.js';

/** Steer toward the next ring: bank to its bearing, pitch to its height. */
function createAutopilot() {
  // Which way to turn when the ring is directly behind the plane: the
  // heading error sits on the +PI/-PI wrap there, and flipping the sign
  // every step would chatter the bank left-right and fly straight past.
  // So the turn direction is held until the ring is well ahead again.
  let turnSign = 1;
  return function autopilot(state, course) {
    const ring = course[state.nextRing];
    if (!ring) return { pitch: 0, roll: 0, throttle: 0 };
    const dx = ring.x - state.x;
    const dy = ring.y - state.y;
    const dz = ring.z - state.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - state.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Bank right (roll +1) turns the nose toward a smaller heading, so the
    // held turn direction is the opposite of the heading error's sign.
    if (Math.abs(diff) < 2.5) turnSign = diff >= 0 ? -1 : 1;
    const wantPitch = Math.atan2(dy, Math.max(60, dist));
    // Climb early when the ground ahead rises toward the flight path.
    const ahead = terrainHeight(state.x + Math.sin(state.heading) * 120, state.z + Math.cos(state.heading) * 120);
    const climb = ahead > state.y - 25 ? 0.35 : 0;
    return {
      pitch: Math.max(-1, Math.min(1, (wantPitch + climb) / 0.4)),
      // Bank right (roll +1) turns the nose toward a smaller heading, so a
      // ring ahead to the left of the nose needs the opposite sign.
      roll: Math.abs(diff) > 2.5 ? turnSign : Math.max(-1, Math.min(1, -diff / 0.5)),
      throttle: state.throttle < 0.62 ? 1 : 0,
    };
  };
}

/**
 * Set `world` to the named scene (start, play, ring or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  const autopilot = createAutopilot();
  if (name !== 'play' && name !== 'ring' && name !== 'end') {
    // Title scene: the plane parked on the runway, throttle closed, the
    // island and the first ring ahead in the morning light.
    state.throttle = 0;
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'ring') {
    // Ring scene: fly the first ring, then close on the second, so the frame
    // shows the plane over the island with a golden ring ahead — breaking on
    // distance alone would stop on the runway, 332 m from the first ring.
    for (let i = 0; i < 60 / STEP; i += 1) {
      const events = world.step(STEP, autopilot(state, world.course));
      if (events & (EVENT_CRASH | EVENT_COMPLETE)) break;
      if (state.ringsHit >= 1 && world.ringDistance() < 200) break;
    }
    return { screen: SCREEN_PLAY, best: state.score };
  }
  const limit = name === 'end' ? SHOT_END_LIMIT_SECONDS : SHOT_PLAY_SECONDS;
  if (name === 'play') {
    // Play scene: fly the first two rings, then two seconds more, so the
    // frame catches the plane over the town and river, past the opening leg
    // and before the mountain turn — a fixed time would land mid-turn.
    for (let i = 0; i < 40 / STEP; i += 1) {
      const events = world.step(STEP, autopilot(state, world.course));
      if (events & (EVENT_CRASH | EVENT_COMPLETE)) break;
      if (state.ringsHit >= 2) {
        for (let j = 0; j < 2 / STEP; j += 1) world.step(STEP, autopilot(state, world.course));
        break;
      }
    }
    return { screen: SCREEN_PLAY, best: state.score };
  }
  for (let i = 0; i < limit / STEP; i += 1) {
    const events = world.step(STEP, autopilot(state, world.course));
    if (events & (EVENT_CRASH | EVENT_COMPLETE)) break;
  }
  if (state.status === STATUS_COMPLETE) return { screen: SCREEN_COMPLETE, best: state.score };
  if (state.status === STATUS_CRASHED) return { screen: SCREEN_OVER, best: state.score };
  return { screen: SCREEN_PLAY, best: state.score };
}
