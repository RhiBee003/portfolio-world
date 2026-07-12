import * as THREE from "three";
import { brickMaterial } from "./materials.js";

export function createCat() {
  const cat = new THREE.Group();
  const fur = brickMaterial(0x1a1a1a);
  const furLight = brickMaterial(0x333338);
  const pink = brickMaterial(0xf6c8d7);
  const eye = brickMaterial(0x7ee8f8);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1.1), fur);
  body.position.y = 0.55;
  body.castShadow = true;
  cat.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.5), fur);
  head.position.set(0, 0.95, 0.65);
  head.castShadow = true;
  cat.add(head);

  const earGeo = new THREE.ConeGeometry(0.14, 0.28, 4);
  const earL = new THREE.Mesh(earGeo, fur);
  earL.position.set(-0.2, 1.22, 0.72);
  earL.rotation.z = 0.2;
  const earR = earL.clone();
  earR.position.x = 0.2;
  earR.rotation.z = -0.2;
  cat.add(earL, earR);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.18), furLight);
  snout.position.set(0, 0.82, 0.92);
  cat.add(snout);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.06), pink);
  nose.position.set(0, 0.86, 1.02);
  cat.add(nose);

  const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
  const eyeL = new THREE.Mesh(eyeGeo, eye);
  eyeL.position.set(-0.14, 0.98, 0.88);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.14;
  cat.add(eyeL, eyeR);

  const legGeo = new THREE.BoxGeometry(0.16, 0.38, 0.16);
  const legOffsets = [
    [-0.22, 0.19, 0.35],
    [0.22, 0.19, 0.35],
    [-0.22, 0.19, -0.35],
    [0.22, 0.19, -0.35],
  ];
  legOffsets.forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, fur);
    leg.position.set(lx, ly, lz);
    leg.castShadow = true;
    cat.add(leg);
  });

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), fur);
  tail.position.set(0, 0.72, -0.75);
  tail.rotation.x = -0.5;
  tail.castShadow = true;
  cat.add(tail);

  cat.userData.tail = tail;

  return cat;
}

export class CatController {
  constructor(cat) {
    this.cat = cat;
    this.position = new THREE.Vector3(0, 0, 14);
    this.facing = 0;
    this.walkPhase = 0;
    this.radius = 0.45;
    this.speed = 5.5;
    this.sprint = 9.5;
    this.turnSpeed = 2.75;
    this.verticalVelocity = 0;
    this.grounded = true;
    this.jumpForce = 7.2;
    this.gravity = 24;
    this.isMoving = false;
    this.headBob = 0;
    this.viewPitch = -0.06;
  }

  getForward() {
    return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
  }

  getEyePosition(target = new THREE.Vector3()) {
    const forward = this.getForward();
    const bob = this.grounded && this.isMoving ? Math.sin(this.walkPhase) * 0.035 : 0;
    this.headBob = bob;
    return target.set(
      this.position.x + forward.x * 0.14,
      this.position.y + 0.98 + bob,
      this.position.z + forward.z * 0.14
    );
  }

  getEyeLookAt(target = new THREE.Vector3()) {
    const cosPitch = Math.cos(this.viewPitch);
    const lookDir = new THREE.Vector3(
      Math.sin(this.facing) * cosPitch,
      -Math.sin(this.viewPitch),
      Math.cos(this.facing) * cosPitch
    );
    return target.copy(this.getEyePosition()).addScaledVector(lookDir, 12);
  }

  update(dt, input, collisions, checkCollision, mode, viewYaw) {
    const wish = new THREE.Vector3();
    let turning = false;

    if (mode === "firstPerson") {
      const forward = new THREE.Vector3(Math.sin(viewYaw), 0, Math.cos(viewYaw)).normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

      if (input.forward) wish.add(forward);
      if (input.back) wish.sub(forward);
      if (input.right) wish.add(right);
      if (input.left) wish.sub(right);
    } else if (viewYaw !== undefined) {
      const camForward = new THREE.Vector3(Math.sin(viewYaw), 0, Math.cos(viewYaw)).normalize();
      const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

      if (input.forward) wish.add(camForward);
      if (input.back) wish.sub(camForward);
      if (input.right) wish.add(camRight);
      if (input.left) wish.sub(camRight);
    } else {
      if (input.forward) wish.z -= 1;
      if (input.back) wish.z += 1;
      if (input.left) wish.x -= 1;
      if (input.right) wish.x += 1;
    }

    const speed = input.sprint && (wish.lengthSq() > 0 || turning) ? this.sprint : this.speed;
    this.isMoving = false;

    if (wish.lengthSq() > 0) {
      wish.normalize();

      if (mode !== "firstPerson") {
        const facingDir = this.getForward();
        const backing = facingDir.dot(wish) < -0.2;
        if (!backing) {
          const targetFacing = Math.atan2(wish.x, wish.z);
          this.facing = lerpAngle(this.facing, targetFacing, 1 - Math.exp(-12 * dt));
        }
      }

      this.walkPhase += dt * (input.sprint ? 14 : 9);
      this.isMoving = true;

      const step = wish.multiplyScalar(speed * dt);
      const nextX = this.position.x + step.x;
      const nextZ = this.position.z + step.z;
      if (!checkCollision(nextX, this.position.z, this.radius, collisions)) {
        this.position.x = nextX;
      }
      if (!checkCollision(this.position.x, nextZ, this.radius, collisions)) {
        this.position.z = nextZ;
      }
    }

    if (input.jumpQueued && this.grounded) {
      this.verticalVelocity = this.jumpForce;
      this.grounded = false;
    }
    input.jumpQueued = false;

    this.verticalVelocity -= this.gravity * dt;
    this.position.y += this.verticalVelocity * dt;

    if (this.position.y <= 0) {
      this.position.y = 0;
      this.verticalVelocity = 0;
      this.grounded = true;
    }

    this.cat.position.x = this.position.x;
    this.cat.position.z = this.position.z;
    this.cat.rotation.y = this.facing;

    let visualY = this.position.y;
    if (this.grounded && this.isMoving) {
      visualY += Math.sin(this.walkPhase) * 0.04;
    }
    this.cat.position.y = visualY;

    if (this.cat.userData.tail) {
      const tailLift = this.grounded ? 0 : 0.5;
      this.cat.userData.tail.rotation.x = -0.5 - tailLift;
      this.cat.userData.tail.rotation.y = Math.sin(this.walkPhase * 1.2) * 0.35;
    }
  }
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
