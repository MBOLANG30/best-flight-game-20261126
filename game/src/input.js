// Keyboard and pointer input. Held keys give a pitch / roll / throttle
// command; one-shot presses (start or restart, pause, camera view) are queued
// as bit flags and taken once by the loop, so a press between two frames is
// never lost and never counted twice. Dragging with the mouse steers too:
// drag left or right to bank, up or down to pitch.
import { STEP } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_VIEW = 4;

const PITCH_UP = new Set(['ArrowUp', 'KeyW']);
const PITCH_DOWN = new Set(['ArrowDown', 'KeyS']);
const ROLL_LEFT = new Set(['ArrowLeft', 'KeyA']);
const ROLL_RIGHT = new Set(['ArrowRight', 'KeyD']);
const THROTTLE_UP = new Set(['ShiftLeft', 'ShiftRight']);
const THROTTLE_DOWN = new Set(['ControlLeft', 'ControlRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const VIEW = new Set(['KeyC', 'KeyV']);

export function createInput(target) {
  let pitchUp = false;
  let pitchDown = false;
  let rollLeft = false;
  let rollRight = false;
  let throttleUp = false;
  let throttleDown = false;
  let actions = 0;
  // Mouse steering: a drag's offset from its start, in pixels, eased to rest.
  let dragX = 0;
  let dragY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (PITCH_UP.has(event.code)) pitchUp = true;
    else if (PITCH_DOWN.has(event.code)) pitchDown = true;
    else if (ROLL_LEFT.has(event.code)) rollLeft = true;
    else if (ROLL_RIGHT.has(event.code)) rollRight = true;
    else if (THROTTLE_UP.has(event.code)) throttleUp = true;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (VIEW.has(event.code)) {
      if (!event.repeat) actions |= ACTION_VIEW;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (PITCH_UP.has(event.code)) pitchUp = false;
    else if (PITCH_DOWN.has(event.code)) pitchDown = false;
    else if (ROLL_LEFT.has(event.code)) rollLeft = false;
    else if (ROLL_RIGHT.has(event.code)) rollRight = false;
    else if (THROTTLE_UP.has(event.code)) throttleUp = false;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    pitchUp = pitchDown = rollLeft = rollRight = throttleUp = throttleDown = false;
    dragging = false;
    dragX = dragY = 0;
  });
  target.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    dragX += event.clientX - lastX;
    dragY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });

  return {
    /** The pilot's command this frame: pitch, roll and throttle, each -1..1. */
    command() {
      const pitch = (pitchUp ? 1 : 0) - (pitchDown ? 1 : 0) - dragY / 160;
      const roll = (rollRight ? 1 : 0) - (rollLeft ? 1 : 0) + dragX / 160;
      const throttle = (throttleUp ? 1 : 0) - (throttleDown ? 1 : 0);
      // A released drag eases back to centre instead of snapping.
      dragX *= Math.pow(0.02, STEP);
      dragY *= Math.pow(0.02, STEP);
      return {
        pitch: Math.max(-1, Math.min(1, pitch)),
        roll: Math.max(-1, Math.min(1, roll)),
        throttle,
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
