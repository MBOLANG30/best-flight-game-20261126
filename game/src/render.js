// Drawing only: the Three.js scene (island, sea, sky, plane, rings, clouds)
// plus a 2D overlay canvas carrying the lit instruments — airspeed and
// altitude tapes, compass strip, attitude indicator, throttle, rings, timer
// and score — and the title, pause and game-over panels. The world state in,
// pixels out.
import { BEST_KEY, FONT, PALETTE, RINGS } from './config.js';
import { buildIsland } from './terrain.js';
import { buildPlane } from './plane.js';
import { forwardOf } from './world.js';
// The import map in index.html maps "three" to the vendored minified build.
import * as THREE from 'three';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

export const VIEW_CHASE = 'chase';
export const VIEW_COCKPIT = 'cockpit';

const KT = 1.94384;
const FT = 3.28084;

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function headingDeg(heading) {
  const d = ((-heading * 180) / Math.PI) % 360;
  return (d + 360) % 360;
}

function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas, hudCanvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9fc6e8');
  scene.fog = new THREE.Fog(0xbcd9ee, 900, 4300);

  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(900, 1400, 500);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbcd9ee, 0x5d7a4a, 0.9));

  const island = buildIsland(THREE);
  scene.add(island.group);
  const plane = buildPlane(THREE);
  scene.add(plane.group);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 9000);
  const camPos = new THREE.Vector3(0, 40, -300);
  const camLook = new THREE.Vector3(0, 10, 0);
  const tmp = new THREE.Vector3();

  const hud = hudCanvas.getContext('2d');
  const view = { w: 0, h: 0, dpr: 1 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    hudCanvas.width = Math.round(w * dpr);
    hudCanvas.height = Math.round(h * dpr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    view.w = w;
    view.h = h;
    view.dpr = dpr;
  }
  resize();
  window.addEventListener('resize', resize);

  // ---------------------------------------------------------- 2D instruments

  function panel(x, y, w, h, fill) {
    hud.fillStyle = fill;
    hud.beginPath();
    hud.roundRect(x, y, w, h, 10);
    hud.fill();
  }

  function text(value, x, y, size, color, align, weight) {
    hud.font = `${weight || 600} ${size}px ${FONT}`;
    hud.fillStyle = color;
    hud.textAlign = align;
    hud.textBaseline = 'alphabetic';
    hud.fillText(value, x, y);
  }

  function drawCompass(state) {
    const cx = view.w / 2;
    const y = 14;
    const w = 340;
    const h = 52;
    panel(cx - w / 2, y, w, h, PALETTE.hudGlass);
    const hdg = headingDeg(state.heading);
    hud.save();
    hud.beginPath();
    hud.rect(cx - w / 2, y, w, h);
    hud.clip();
    // Ticks every 15 degrees; a tick is major when it sits near a cardinal.
    for (let d = -75; d <= 75; d += 15) {
      const deg = (hdg + d + 360) % 360;
      const m45 = ((deg % 45) + 45) % 45;
      const near45 = m45 < 7.5 || m45 > 37.5;
      const x = cx + (d / 75) * (w / 2 - 14);
      hud.strokeStyle = near45 ? PALETTE.hudAmber : 'rgba(238,244,248,0.5)';
      hud.lineWidth = near45 ? 2 : 1;
      hud.beginPath();
      hud.moveTo(x, y + 8);
      hud.lineTo(x, y + (near45 ? 22 : 16));
      hud.stroke();
    }
    // Cardinal labels, placed by their own bearing so they show at any heading.
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (const [degStr, label] of Object.entries(labels)) {
      const deg = Number(degStr);
      let d = (deg - hdg + 540) % 360 - 180;
      if (Math.abs(d) > 72) continue;
      const x = cx + (d / 75) * (w / 2 - 14);
      text(label, x, y + 42, 15, PALETTE.hudText, 'center');
    }
    hud.restore();
    hud.strokeStyle = PALETTE.hudAmber;
    hud.lineWidth = 2;
    hud.beginPath();
    hud.moveTo(cx, y + 4);
    hud.lineTo(cx, y + 12);
    hud.stroke();
    text(`HDG ${String(Math.round(hdg)).padStart(3, '0')}°`, cx, y + h + 20, 15, PALETTE.hudAmber, 'center');
  }

  function drawTape(x, y, h, value, step, unit, label, format) {
    const w = 92;
    panel(x, y, w, h, PALETTE.hudGlass);
    text(label, x + w / 2, y + 22, 13, PALETTE.hudCyan, 'center');
    hud.save();
    hud.beginPath();
    hud.rect(x, y + 28, w, h - 52);
    hud.clip();
    const cy = y + h / 2;
    const pxPerUnit = (h - 56) / (step * 4);
    for (let v = Math.max(0, Math.floor((value - step * 2) / step) * step); v <= value + step * 2; v += step) {
      const yy = cy - (v - value) * pxPerUnit;
      if (yy < y + 30 || yy > y + h - 28) continue;
      hud.strokeStyle = 'rgba(238,244,248,0.6)';
      hud.lineWidth = 1;
      hud.beginPath();
      hud.moveTo(x + 8, yy);
      hud.lineTo(x + 18, yy);
      hud.stroke();
      // The amber band shows the current value: keep its neighbours' labels clear of it.
      if (Math.abs(yy - cy) < 20) continue;
      text(format(v), x + 24, yy + 5, 14, PALETTE.hudText, 'left');
    }
    hud.restore();
    panel(x - 4, cy - 15, w + 8, 30, 'rgba(255, 180, 84, 0.92)');
    text(format(value), x + w / 2, cy + 6, 17, '#1a1206', 'center', 700);
    text(unit, x + w / 2, y + h - 8, 12, PALETTE.hudCyan, 'center');
  }

  function drawAttitude(state) {
    const cx = view.w / 2;
    const cy = view.h - 88;
    const r = 60;
    panel(cx - 150, cy - r - 26, 300, r * 2 + 52, PALETTE.hudGlass);
    hud.save();
    hud.beginPath();
    hud.arc(cx, cy, r, 0, Math.PI * 2);
    hud.clip();
    hud.translate(cx, cy);
    hud.rotate(-state.roll);
    const pitchPx = clamp(state.pitch, -0.5, 0.5) * r * 1.6;
    hud.fillStyle = '#3f8fd2';
    hud.fillRect(-r - 4, -r - 4 - pitchPx, r * 2 + 8, r + 4 + pitchPx);
    hud.fillStyle = '#7a5a34';
    hud.fillRect(-r - 4, pitchPx, r * 2 + 8, r + 4 - pitchPx + 4);
    hud.strokeStyle = 'rgba(238,244,248,0.85)';
    hud.lineWidth = 1.5;
    for (const deg of [-20, -10, 10, 20]) {
      const yy = pitchPx - (deg * Math.PI / 180) * r * 1.6;
      hud.beginPath();
      hud.moveTo(-22, yy);
      hud.lineTo(22, yy);
      hud.stroke();
    }
    hud.beginPath();
    hud.moveTo(-r, pitchPx);
    hud.lineTo(r, pitchPx);
    hud.stroke();
    hud.restore();
    // Fixed aircraft symbol and the bank pointer.
    hud.strokeStyle = PALETTE.hudAmber;
    hud.lineWidth = 3;
    hud.beginPath();
    hud.moveTo(cx - 34, cy);
    hud.lineTo(cx - 10, cy);
    hud.moveTo(cx + 10, cy);
    hud.lineTo(cx + 34, cy);
    hud.moveTo(cx, cy);
    hud.lineTo(cx, cy + 8);
    hud.stroke();
    hud.beginPath();
    hud.arc(cx, cy, r, 0, Math.PI * 2);
    hud.strokeStyle = PALETTE.hudText;
    hud.lineWidth = 2;
    hud.stroke();
    text('ATT', cx, cy - r - 8, 12, PALETTE.hudCyan, 'center');
  }

  function drawStatus(state, best) {
    const x = 16;
    let y = view.h - 148;
    panel(x, y, 210, 132, PALETTE.hudGlass);
    text(`THR ${Math.round(state.throttle * 100)}%`, x + 14, y + 26, 16, PALETTE.hudText, 'left');
    hud.fillStyle = 'rgba(238,244,248,0.25)';
    hud.fillRect(x + 14, y + 36, 182, 10);
    hud.fillStyle = PALETTE.hudCyan;
    hud.fillRect(x + 14, y + 36, 182 * state.throttle, 10);
    text(`RINGS  ${state.ringsHit} / ${RINGS.count}`, x + 14, y + 70, 16, PALETTE.hudAmber, 'left');
    text(`TIME  ${fmtTime(state.timeLeft)}`, x + 14, y + 96, 16, state.timeLeft < 20 ? '#ff6b5e' : PALETTE.hudText, 'left');
    text(`SCORE  ${state.score}`, x + 14, y + 122, 16, PALETTE.hudText, 'left');
    text(`BEST  ${best}`, view.w - 16, view.h - 16, 15, PALETTE.hudCyan, 'right');
  }

  function drawNextRing(state) {
    if (state.status !== 'flying') return;
    const ring = island.course[state.nextRing];
    if (!ring) return;
    const dx = ring.x - state.x;
    const dy = ring.y - state.y;
    const dz = ring.z - state.z;
    const dist = Math.hypot(dx, dy, dz);
    const bearing = Math.atan2(dx, dz);
    let rel = bearing - state.heading;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    const cx = view.w / 2;
    const cy = view.h / 2;
    const r = 74;
    const ax = cx + Math.sin(rel) * r;
    const ay = cy - Math.cos(rel) * r * 0.55;
    hud.save();
    hud.translate(ax, ay);
    hud.rotate(rel * 0.4);
    hud.fillStyle = PALETTE.ringNext;
    hud.beginPath();
    hud.moveTo(0, -12);
    hud.lineTo(9, 8);
    hud.lineTo(-9, 8);
    hud.closePath();
    hud.fill();
    hud.restore();
    text(`NEXT RING  ${Math.round(dist)} m`, cx, cy - 96, 16, PALETTE.ringNext, 'center', 700);
  }

  function drawPanel(title, lines, prompt, accent, dy) {
    const w = 620;
    const h = 150 + lines.length * 32;
    const x = (view.w - w) / 2;
    const y = (view.h - h) / 2 + (dy ?? 0);
    panel(x, y, w, h, 'rgba(8, 14, 24, 0.78)');
    hud.strokeStyle = accent;
    hud.lineWidth = 2;
    hud.beginPath();
    hud.roundRect(x, y, w, h, 10);
    hud.stroke();
    text(title, view.w / 2, y + 64, 44, accent, 'center', 800);
    lines.forEach((line, i) => {
      text(line, view.w / 2, y + 108 + i * 32, 19, PALETTE.hudText, 'center');
    });
    text(prompt, view.w / 2, y + h - 28, 20, PALETTE.hudAmber, 'center', 700);
  }

  function drawHud(state, screen, best) {
    hud.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    hud.clearRect(0, 0, view.w, view.h);
    if (screen === SCREEN_TITLE) {
      drawCompass(state);
      // No attitude indicator on the title screen: the parked plane sits
      // where it would be, and the panel moves up so the aircraft shows.
      drawPanel(
        'MERIDIAN RUN',
        [
          'Fly the golden rings around the island — 12 rings, 150 seconds.',
          'Each ring scores 100 and adds 8 seconds. Finish them all for +500.',
          'W / S or ↑ / ↓ pitch · A / D or ← / → bank · Shift / Ctrl throttle',
          'Drag with the mouse to steer · C switches cockpit / chase view · P pauses',
          `Best score: ${best}`,
        ],
        'Press Space or click to take off',
        PALETTE.hudAmber,
        -70,
      );
      return;
    }
    drawCompass(state);
    drawTape(16, 84, 220, state.speed * KT, 20, 'KT', 'AIRSPEED', (v) => String(Math.round(v)));
    drawTape(view.w - 108, 84, 220, state.y * FT, 100, 'FT', 'ALTITUDE', (v) => String(Math.round(v)));
    drawAttitude(state);
    drawStatus(state, best);
    drawNextRing(state);
    if (state.message) {
      text(state.message, view.w / 2, 124, 17, PALETTE.hudAmber, 'center', 700);
    }
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The island waits below. The rings will keep.'], 'Press P to resume', PALETTE.hudCyan);
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'CRASHED',
        [`Score ${state.score} · Rings ${state.ringsHit} / ${RINGS.count}`, state.message],
        'Press Space or click to fly again',
        '#ff6b5e',
      );
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel(
        'COURSE COMPLETE',
        [`Score ${state.score} · All ${RINGS.count} rings flown`, 'Meridian Tower salutes you, pilot.'],
        'Press Space or click to fly again',
        PALETTE.ringNext,
      );
    }
  }

  // ---------------------------------------------------------- 3D frame

  /** Paint one frame: move the plane and camera, light the rings, draw the HUD. */
  function draw(state, screen, best, dt, viewMode, time, flashAge) {
    const fwd = forwardOf(state.heading, state.pitch);
    plane.group.position.set(state.x, state.y, state.z);
    plane.group.rotation.order = 'YXZ';
    plane.group.rotation.y = state.heading;
    plane.group.rotation.x = -state.pitch;
    plane.group.rotation.z = -state.roll;
    plane.propeller.rotation.z += state.speed * dt * 1.4;
    plane.strobe.visible = (time * 1.5) % 1 < 0.12;

    const pulse = 1.1 + Math.sin(time * 4) * 0.45;
    island.ringMeshes.forEach((mesh, i) => {
      if (i < state.ringsHit) mesh.material.emissiveIntensity = 0.12;
      else if (i === state.nextRing) mesh.material.emissiveIntensity = pulse;
      else mesh.material.emissiveIntensity = 0.55;
    });
    for (const cloud of island.clouds) {
      cloud.position.x += cloud.userData.drift * dt;
      if (cloud.position.x > 2500) cloud.position.x = -2500;
    }

    if (viewMode === VIEW_COCKPIT) {
      tmp.set(state.x + fwd.x * 1.2, state.y + 1.35, state.z + fwd.z * 1.2);
      if (camPos.distanceTo(tmp) > 60) camPos.copy(tmp);
      else camPos.lerp(tmp, 1 - Math.exp(-18 * dt));
      tmp.set(state.x + fwd.x * 120, state.y + fwd.y * 120, state.z + fwd.z * 120);
      if (camLook.distanceTo(tmp) > 120) camLook.copy(tmp);
      else camLook.lerp(tmp, 1 - Math.exp(-18 * dt));
    } else {
      // Chase: the camera sits behind and above the plane, looking far ahead,
      // so the aircraft reads in the upper half of the frame, clear of the
      // attitude indicator at the bottom. After a jump (a staged screenshot
      // scene, a restart) the camera snaps instead of chasing for seconds.
      tmp.set(state.x - fwd.x * 19, state.y - fwd.y * 19 + 7.5, state.z - fwd.z * 19);
      if (camPos.distanceTo(tmp) > 60) camPos.copy(tmp);
      else camPos.lerp(tmp, 1 - Math.exp(-5 * dt));
      tmp.set(state.x + fwd.x * 34, state.y + fwd.y * 34 + 4, state.z + fwd.z * 34);
      if (camLook.distanceTo(tmp) > 120) camLook.copy(tmp);
      else camLook.lerp(tmp, 1 - Math.exp(-8 * dt));
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    renderer.render(scene, camera);
    drawHud(state, screen, best);
    // A flown ring flashes gold around the frame, fading over half a second.
    if (flashAge !== undefined && flashAge < 0.6) {
      hud.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      hud.strokeStyle = `rgba(242, 201, 76, ${(1 - flashAge / 0.6) * 0.55})`;
      hud.lineWidth = 10;
      hud.strokeRect(5, 5, view.w - 10, view.h - 10);
    }
  }

  return { draw, resize };
}
