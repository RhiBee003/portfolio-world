import * as THREE from "three";

const LIFETIME = 4.2;
const BASE_OPACITY = 0.96;
const SPAWN_INTERVAL = 0.1;
const MAX_PETALS = 95;

const PETAL_COLORS = [0xffb8d8, 0xff9ec8, 0xffd0e8, 0xffa8c8, 0xffc8e0];

const _spawnPos = new THREE.Vector3();
const _velocity = new THREE.Vector3();
const _euler = new THREE.Euler();

function createPetalGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.1);
  shape.bezierCurveTo(0.05, 0.1, 0.08, 0.045, 0.06, 0);
  shape.bezierCurveTo(0.035, -0.055, 0, -0.08, -0.035, -0.055);
  shape.bezierCurveTo(-0.08, -0.02, -0.06, 0.05, 0, 0.1);
  return new THREE.ShapeGeometry(shape);
}

const petalGeometry = createPetalGeometry();

function createPetalMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: BASE_OPACITY,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
}

export function createCherryPetalTrail() {
  const group = new THREE.Group();
  group.name = "cherry-petals";
  const trees = [];
  const petals = [];
  let spawnTimer = 0;

  function registerTree(tree) {
    if (tree.userData.petalEmitters?.length) {
      trees.push(tree);
    }
  }

  function spawnPetal() {
    if (!trees.length || petals.length >= MAX_PETALS) return;

    const tree = trees[Math.floor(Math.random() * trees.length)];
    const emitters = tree.userData.petalEmitters;
    const emitter = emitters[Math.floor(Math.random() * emitters.length)];

    tree.updateMatrixWorld(true);
    emitter.getWorldPosition(_spawnPos);
    const radius = emitter.userData.emitterRadius ?? 0.5;
    _spawnPos.x += (Math.random() - 0.5) * radius * 2;
    _spawnPos.y += Math.random() * radius * 0.8;
    _spawnPos.z += (Math.random() - 0.5) * radius * 2;

    const color = PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)];
    const baseScale = 0.58 + Math.random() * 0.38;
    const mesh = new THREE.Mesh(petalGeometry, createPetalMaterial(color));
    mesh.position.copy(_spawnPos);
    mesh.scale.setScalar(baseScale);
    mesh.renderOrder = 5;
    _euler.set(
      (Math.random() - 0.5) * Math.PI * 0.8,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * Math.PI * 0.8
    );
    mesh.rotation.copy(_euler);
    group.add(mesh);

    _velocity.set(
      (Math.random() - 0.5) * 0.55,
      -0.08 - Math.random() * 0.18,
      (Math.random() - 0.5) * 0.55
    );

    petals.push({
      mesh,
      age: 0,
      baseScale,
      velocity: _velocity.clone(),
      spin: new THREE.Vector3(
        (Math.random() - 0.5) * 1.8,
        (Math.random() - 0.5) * 1.8,
        (Math.random() - 0.5) * 1.8
      ),
      swayPhase: Math.random() * Math.PI * 2,
    });
  }

  function update(dt) {
    spawnTimer += dt;
    while (spawnTimer >= SPAWN_INTERVAL && petals.length < MAX_PETALS) {
      spawnTimer -= SPAWN_INTERVAL;
      const burst = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < burst; i += 1) spawnPetal();
    }

    for (let i = petals.length - 1; i >= 0; i -= 1) {
      const petal = petals[i];
      petal.age += dt;
      const t = petal.age / LIFETIME;

      if (t >= 1 || petal.mesh.position.y < -0.8) {
        group.remove(petal.mesh);
        petal.mesh.material.dispose();
        petals.splice(i, 1);
        continue;
      }

      petal.swayPhase += dt * 1.8;
      const sway = Math.sin(petal.swayPhase) * 0.45;
      petal.velocity.x += sway * dt;
      petal.velocity.z += Math.cos(petal.swayPhase * 0.9) * 0.32 * dt;
      petal.velocity.y -= 0.28 * dt;

      petal.mesh.position.x += petal.velocity.x * dt;
      petal.mesh.position.y += petal.velocity.y * dt;
      petal.mesh.position.z += petal.velocity.z * dt;

      petal.mesh.rotation.x += petal.spin.x * dt;
      petal.mesh.rotation.y += petal.spin.y * dt;
      petal.mesh.rotation.z += petal.spin.z * dt;

      const fade = 1 - t;
      const eased = fade ** 0.42;
      petal.mesh.material.opacity = BASE_OPACITY * eased;
      petal.mesh.scale.setScalar(petal.baseScale * (0.85 + eased * 0.15));
    }
  }

  return { group, registerTree, update };
}
