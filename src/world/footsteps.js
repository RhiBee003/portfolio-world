import * as THREE from "three";

const LIFETIME = 2.1;
const BASE_OPACITY = 0.78;
const STEP_THRESHOLD = 0.28;
const GROUND_Y = 0.022;
const PAW_SCALE = 1.22;

const FEET = [
  { phase: 0, lx: -0.14, lz: 0.3 },
  { phase: Math.PI, lx: 0.14, lz: 0.3 },
  { phase: Math.PI, lx: -0.13, lz: -0.3 },
  { phase: 0, lx: 0.13, lz: -0.3 },
];

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _position = new THREE.Vector3();

function createPawGeometry() {
  const s = PAW_SCALE;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.075 * s);
  shape.bezierCurveTo(0.05 * s, 0.075 * s, 0.07 * s, 0.04 * s, 0.07 * s, 0);
  shape.bezierCurveTo(0.07 * s, -0.05 * s, 0.04 * s, -0.075 * s, 0, -0.075 * s);
  shape.bezierCurveTo(-0.04 * s, -0.075 * s, -0.07 * s, -0.05 * s, -0.07 * s, 0);
  shape.bezierCurveTo(-0.07 * s, 0.04 * s, -0.05 * s, 0.075 * s, 0, 0.075 * s);
  return new THREE.ShapeGeometry(shape);
}

const pawGeometry = createPawGeometry();

function createPawMaterial() {
  return new THREE.MeshBasicMaterial({
    color: 0x2e2e36,
    transparent: true,
    opacity: BASE_OPACITY,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
}

export function createFootstepTrail() {
  const group = new THREE.Group();
  const steps = [];
  let prevPhase = null;

  function spawnFootstep(cat, lx, lz) {
    const facing = cat.facing;
    _forward.set(Math.sin(facing), 0, Math.cos(facing));
    _right.set(-Math.cos(facing), 0, Math.sin(facing));
    _position
      .copy(cat.position)
      .addScaledVector(_right, lx)
      .addScaledVector(_forward, lz);
    _position.y = GROUND_Y;

    const mesh = new THREE.Mesh(pawGeometry, createPawMaterial());
    mesh.rotation.set(-Math.PI / 2, facing, 0);
    mesh.position.copy(_position);
    mesh.renderOrder = 4;
    group.add(mesh);

    steps.push({ mesh, age: 0 });
  }

  function update(dt, cat) {
    const moving = cat.isMoving && cat.grounded && !cat.isSeated;

    if (moving) {
      const phase = cat.walkPhase;
      if (prevPhase !== null) {
        for (const foot of FEET) {
          const prev = Math.sin(prevPhase + foot.phase);
          const curr = Math.sin(phase + foot.phase);
          if (prev > STEP_THRESHOLD && curr <= STEP_THRESHOLD) {
            spawnFootstep(cat, foot.lx, foot.lz);
          }
        }
      }
      prevPhase = phase;
    } else {
      prevPhase = cat.walkPhase;
    }

    for (let i = steps.length - 1; i >= 0; i -= 1) {
      const step = steps[i];
      step.age += dt;
      const t = step.age / LIFETIME;
      if (t >= 1) {
        group.remove(step.mesh);
        step.mesh.material.dispose();
        steps.splice(i, 1);
        continue;
      }

      const fade = 1 - t;
      const eased = fade ** 0.55;
      step.mesh.material.opacity = BASE_OPACITY * eased;
      const scale = 0.9 + eased * 0.1;
      step.mesh.scale.set(scale, scale, 1);
    }
  }

  return { group, update };
}
