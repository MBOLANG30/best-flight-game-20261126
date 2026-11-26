// The flight model and the rules, with no drawing and no browser in it: the
// plane's position, heading, pitch, roll and speed, the ring course, the
// countdown, the score and the crash. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react without the
// world knowing about screens or sound.
import { GAME, PLANE, RINGS, STEP, WORLD } from './config.js';
import { ringCourse, terrainHeight } from './terrain.js';

export const EVENT_RING = 1;
export const EVENT_CRASH = 2;
export const EVENT_COMPLETE = 4;
export const EVENT_TIMEOUT = 8;

export const STATUS_FLYING = 'flying';
export const STATUS_CRASHED = 'crashed';
export const STATUS_COMPLETE = 'complete';
export const STATUS_TIMEOUT = 'timeout';

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Forward unit vector from heading (yaw, radians) and pitch (radians). */
export function forwardOf(heading, pitch) {
  const cp = Math.cos(pitch);
  return { x: Math.sin(heading) * cp, y: Math.sin(pitch), z: Math.cos(heading) * cp };
}

export function createWorld() {
  const course = ringCourse();
  const state = {
    x: PLANE.startPos.x,
    y: PLANE.startPos.y,
    z: PLANE.startPos.z,
    heading: PLANE.startHeading,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    score: 0,
    ringsHit: 0,
    timeLeft: GAME.startTime,
    elapsed: 0,
    status: STATUS_FLYING,
    nextRing: 0,
    message: '',
    grounded: true,
  };
  // Signed distance along the next ring's normal, for the crossing test.
  let prevAlong = 0;

  function reset() {
    state.x = PLANE.startPos.x;
    state.y = PLANE.startPos.y;
    state.z = PLANE.startPos.z;
    state.heading = PLANE.startHeading;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0;
    state.score = 0;
    state.ringsHit = 0;
    state.timeLeft = GAME.startTime;
    state.elapsed = 0;
    state.status = STATUS_FLYING;
    state.nextRing = 0;
    state.message = '';
    state.grounded = true;
    prevAlong = alongNext();
  }

  function alongNext() {
    const ring = course[state.nextRing];
    return (state.x - ring.x) * ring.nx + (state.y - ring.y) * ring.ny + (state.z - ring.z) * ring.nz;
  }

  function ringDistance() {
    const ring = course[state.nextRing];
    return Math.hypot(state.x - ring.x, state.y - ring.y, state.z - ring.z);
  }

  /**
   * One fixed step. `input` is { pitch: -1..1 (pull up positive), roll: -1..1
   * (bank right positive), throttle: -1..1 }. Returns EVENT_* flags.
   */
  function step(dt, input) {
    if (state.status !== STATUS_FLYING) return 0;
    let events = 0;
    state.elapsed += dt;
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.status = STATUS_TIMEOUT;
      state.message = 'Out of time — the course waits for another run.';
      return EVENT_TIMEOUT;
    }

    // Throttle sets the target speed; the plane eases toward it. At throttle
    // zero the plane sits still on the runway; in the air it needs throttle
    // above stall speed, or it sinks.
    state.throttle = clamp(state.throttle + input.throttle * dt * 0.9, 0, 1);
    const targetSpeed = state.throttle * PLANE.maxSpeed;
    state.speed += (targetSpeed - state.speed) * (1 - Math.exp(-0.9 * dt));
    state.speed = clamp(state.speed, 0, PLANE.maxSpeed);

    // Pitch and roll ease toward the pilot's command; heading follows the bank.
    const wantPitch = clamp(input.pitch * PLANE.maxPitch, -PLANE.maxPitch, PLANE.maxPitch);
    const wantRoll = clamp(input.roll * PLANE.maxRoll, -PLANE.maxRoll, PLANE.maxRoll);
    state.pitch += (wantPitch - state.pitch) * Math.min(1, PLANE.pitchRate * dt * 3);
    state.roll += (wantRoll - state.roll) * Math.min(1, PLANE.rollRate * dt * 3);
    state.heading += -Math.sin(state.roll) * PLANE.turnRate * (state.speed / PLANE.cruiseSpeed) * dt;

    // Move along the nose.
    const fwd = forwardOf(state.heading, state.pitch);
    state.x += fwd.x * state.speed * dt;
    state.y += fwd.y * state.speed * dt;
    state.z += fwd.z * state.speed * dt;
    const ground = Math.max(terrainHeight(state.x, state.z), 0.4);
    if (state.grounded) {
      // Rolling on the ground: the wheels follow the terrain, and the plane
      // lifts off only once it is fast enough and the pilot pulls up.
      state.y = ground + 1.2;
      if (state.speed > PLANE.stallSpeed + 4 && state.pitch > 0.04) {
        state.grounded = false;
        state.y += 0.6;
      }
    } else {
      // Below stall speed an airborne plane sinks.
      if (state.speed < PLANE.stallSpeed) {
        state.y -= PLANE.sinkRate * (1 - state.speed / PLANE.stallSpeed) * dt;
      }
      // Meeting the ground in the air: a gentle descent lands the plane, a
      // hard one crashes it.
      if (state.y <= ground + 1.2) {
        const verticalSpeed = fwd.y * state.speed;
        if (verticalSpeed > -6 && Math.abs(state.pitch) < 0.25) {
          state.grounded = true;
          state.y = ground + 1.2;
        } else {
          state.y = ground + 1.2;
          state.status = STATUS_CRASHED;
          state.message = 'Crashed into the terrain — press Space to fly again.';
          return events | EVENT_CRASH;
        }
      }
    }

    // Out of bounds: the island ends, so bank home instead of flying to sea.
    if (Math.abs(state.x) > WORLD.bounds || Math.abs(state.z) > WORLD.bounds) {
      const home = Math.atan2(-state.x, -state.z);
      let diff = home - state.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      state.heading += clamp(diff, -1, 1) * dt * 0.8;
      state.message = 'Turning back to the island.';
    } else if (state.message === 'Turning back to the island.') {
      state.message = '';
    }

    // Ring crossing: the plane passes the ring's plane inside its radius.
    const along = alongNext();
    if (prevAlong < 0 && along >= 0 && state.nextRing < RINGS.count) {
      const ring = course[state.nextRing];
      const d = Math.hypot(state.x - ring.x, state.y - ring.y, state.z - ring.z);
      if (d < RINGS.radius) {
        state.ringsHit += 1;
        state.score += RINGS.passScore;
        state.timeLeft += RINGS.timeBonus;
        events |= EVENT_RING;
        state.nextRing += 1;
        if (state.nextRing >= RINGS.count) {
          state.status = STATUS_COMPLETE;
          state.score += GAME.completeBonus;
          state.message = 'Course complete — every ring flown!';
          return events | EVENT_COMPLETE;
        }
        prevAlong = alongNext();
      }
    }
    prevAlong = along;

    return events;
  }

  reset();
  return { state, course, reset, step, ringDistance };
}
