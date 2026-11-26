// Sound, synthesised in code — no audio files, no network. A low engine hum
// whose pitch follows the throttle, a two-note chime when a ring is flown and
// a dull thud on a crash. Everything is guarded: a browser with no audio, or
// one that refuses to start it before the first gesture, plays silent.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let started = false;

  function ensure() {
    if (ctx !== null) return ctx !== null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function tone(freq, when, dur, type, vol) {
    if (!ensure() || ctx === null) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + when);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + dur + 0.05);
    } catch {
      // Silence is always acceptable.
    }
  }

  return {
    /** Start the engine hum (called on the first gesture, once). */
    startEngine() {
      if (started) return;
      started = true;
      if (!ensure() || ctx === null) return;
      try {
        if (ctx.state === 'suspended') void ctx.resume();
        if (engineGain !== null) engineGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.5);
      } catch {
        // Silence is always acceptable.
      }
    },
    /** Follow the throttle: faster prop, higher hum. */
    setThrottle(throttle, speed) {
      if (!ensure() || ctx === null || engineOsc === null || engineFilter === null) return;
      try {
        if (ctx.state === 'suspended') void ctx.resume();
        const t = ctx.currentTime;
        engineOsc.frequency.setTargetAtTime(48 + throttle * 70 + speed * 0.25, t, 0.1);
        engineFilter.frequency.setTargetAtTime(280 + throttle * 900, t, 0.1);
        if (engineGain !== null) engineGain.gain.setTargetAtTime(0.03 + throttle * 0.05, t, 0.1);
      } catch {
        // Silence is always acceptable.
      }
    },
    /** Two bright notes for a flown ring. */
    ring() {
      tone(880, 0, 0.35, 'sine', 0.16);
      tone(1318, 0.09, 0.5, 'sine', 0.14);
    },
    /** A low thud for a crash. */
    crash() {
      tone(70, 0, 0.5, 'sine', 0.3);
      tone(45, 0.05, 0.6, 'triangle', 0.25);
    },
    /** A short fanfare when the course is complete. */
    complete() {
      tone(523, 0, 0.3, 'sine', 0.15);
      tone(659, 0.12, 0.3, 'sine', 0.15);
      tone(784, 0.24, 0.45, 'sine', 0.16);
      tone(1046, 0.38, 0.7, 'sine', 0.16);
    },
  };
}
