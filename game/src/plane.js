// The aircraft: a low-poly single-propeller plane built from primitives, in
// Meridian Air livery (cream fuselage, teal wings, orange accents). The nose
// points along +Z when the group's rotation is zero, so the flight model can
// steer it with yaw / pitch / roll directly. The propeller spins with speed
// and the nav lights glow, so the aircraft reads as alive in every screenshot.
import { PALETTE } from './config.js';

/** Build the plane. Returns { group, propeller, strobe } for animation. */
export function buildPlane(THREE) {
  const group = new THREE.Group();
  group.name = 'plane';
  const cream = new THREE.MeshLambertMaterial({ color: PALETTE.planeCream });
  const teal = new THREE.MeshLambertMaterial({ color: PALETTE.planeTeal });
  const orange = new THREE.MeshLambertMaterial({ color: PALETTE.planeOrange });
  const dark = new THREE.MeshLambertMaterial({ color: '#2c313a' });
  const glass = new THREE.MeshLambertMaterial({ color: '#1c3a4d' });

  // Fuselage: a tapered cylinder along Z, nose at +Z.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.55, 7.4, 10), cream);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.2;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.02, 1.6, 10), orange);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 4.7;
  group.add(nose);

  // Canopy: a tinted half-dome over the cockpit.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  canopy.scale.set(1, 0.75, 1.7);
  canopy.position.set(0, 0.55, 1.4);
  group.add(canopy);

  // Main wing: a wide flat box, slightly swept back, with orange tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.28, 2.4), teal);
  wing.position.set(0, -0.15, 0.9);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 2.4), orange);
    tip.position.set(side * 5.55, -0.15, 0.9);
    group.add(tip);
  }

  // Tail: horizontal stabiliser and a vertical fin with the Meridian stripe.
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 1.5), teal);
  tailWing.position.set(0, 0.25, -3.3);
  group.add(tailWing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.1, 1.7), orange);
  fin.position.set(0, 1.15, -3.4);
  group.add(fin);

  // Propeller: a hub plus two blades, spun by the renderer.
  const propeller = new THREE.Group();
  propeller.name = 'propeller';
  propeller.position.set(0, 0, 5.55);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 8), dark);
  hub.rotation.x = Math.PI / 2;
  propeller.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.34, 3.4, 0.12);
  for (const angle of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(bladeGeo, dark);
    blade.rotation.z = angle;
    propeller.add(blade);
  }
  group.add(propeller);

  // Landing gear: two wheels, visible on the runway at the start.
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), dark);
    strut.position.set(side * 1.1, -1.0, 1.2);
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.1, -1.55, 1.2);
    group.add(wheel);
  }

  // Nav lights: red on the left wing, green on the right, white strobe on the tail.
  const lightGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const leftLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: '#ff2a2a' }));
  leftLight.position.set(-5.7, -0.1, 0.9);
  group.add(leftLight);
  const rightLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: '#2aff5a' }));
  rightLight.position.set(5.7, -0.1, 0.9);
  group.add(rightLight);
  const strobe = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  strobe.position.set(0, 0.35, -3.9);
  group.add(strobe);

  return { group, propeller, strobe };
}
