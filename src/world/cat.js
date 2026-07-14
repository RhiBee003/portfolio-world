import * as THREE from "three";
import { brickMaterial, cuteEyeIrisMaterial } from "./materials.js";
import { ARROW_DIM_HEX } from "./pathGuide.js";
import { closestPathT } from "./pathLayout.js";

/** Matches project floating text (`#eaadc3`). */
const PROJECT_TEXT_COLOR = 0xeaadc3;

export function createCat() {
  const cat = new THREE.Group();
  const fur = brickMaterial(0x1a1a1a);
  const furLight = brickMaterial(0x333338);
  const pink = brickMaterial(0xf6c8d7);
  const paw = brickMaterial(0xfff6fa);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.38, 0.88), fur);
  body.position.y = 0.67;
  body.castShadow = true;
  cat.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.54, 0.54), fur);
  head.position.set(0, 0.92, 0.62);
  head.castShadow = true;

  const earGeo = new THREE.CylinderGeometry(0.022, 0.1, 0.4, 6);
  const earL = new THREE.Mesh(earGeo, fur);
  earL.position.set(-0.19, 0.42, 0);
  earL.rotation.set(0, 0, 0.14);
  head.add(earL);

  const earR = new THREE.Mesh(earGeo, fur);
  earR.position.set(0.19, 0.42, 0);
  earR.rotation.set(0, 0, -0.14);
  head.add(earR);

  cat.add(head);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.17), furLight);
  snout.position.set(0, -0.13, 0.28);
  head.add(snout);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.05), pink);
  nose.position.set(0, -0.09, 0.37);
  head.add(nose);

  const glossMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false });
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xfff6fa, roughness: 0.5, metalness: 0 });
  const pupilMat = new THREE.MeshStandardMaterial({
    color: parseInt(ARROW_DIM_HEX.slice(1), 16),
    roughness: 0.45,
    metalness: 0,
  });
  const irisMat = cuteEyeIrisMaterial(PROJECT_TEXT_COLOR);

  function addCuteEye(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const sclera = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.032), scleraMat);
    group.add(sclera);

    const iris = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.145, 0.02), irisMat);
    iris.position.set(0, -0.018, 0.02);
    group.add(iris);

    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.047, 0.058, 0.014), pupilMat);
    pupil.position.set(0, -0.027, 0.03);
    group.add(pupil);

    const glossMain = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.052, 0.011), glossMat);
    glossMain.position.set(0.043, 0.055, 0.037);
    group.add(glossMain);

    const glossSmall = new THREE.Mesh(new THREE.BoxGeometry(0.021, 0.021, 0.009), glossMat);
    glossSmall.position.set(-0.034, 0.02, 0.039);
    group.add(glossSmall);

    head.add(group);
  }

  addCuteEye(-0.17, 0.07, 0.25);
  addCuteEye(0.17, 0.07, 0.25);

  const PAW_HEIGHT = 0.1;
  const LEG_UPPER_HEIGHT = 0.38;
  const LEG_UPPER_HALF = LEG_UPPER_HEIGHT / 2;
  const LEG_HALF = 0.24;
  const BODY_HALF_Y = 0.19;

  function createLeg(x, y, z) {
    const hip = new THREE.Group();
    hip.position.set(x, y, z);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, LEG_UPPER_HEIGHT, 0.11), fur);
    mesh.position.y = -(PAW_HEIGHT + LEG_UPPER_HALF);
    mesh.castShadow = true;

    const pawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, PAW_HEIGHT, 0.13), paw);
    pawMesh.position.y = -LEG_UPPER_HALF - PAW_HEIGHT / 2;
    pawMesh.castShadow = true;
    mesh.add(pawMesh);

    hip.add(mesh);
    body.add(hip);
    return hip;
  }

  const frontLegL = createLeg(-0.14, -BODY_HALF_Y, 0.32);
  const frontLegR = createLeg(0.14, -BODY_HALF_Y, 0.32);
  const backLegL = createLeg(-0.14, -BODY_HALF_Y, -0.32);
  const backLegR = createLeg(0.14, -BODY_HALF_Y, -0.32);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.62), fur);
  tail.position.set(0, 0.74, -0.62);
  tail.rotation.x = -0.5;
  tail.castShadow = true;
  cat.add(tail);

  const standingPose = {
    body: { y: 0.67 },
    head: { x: 0, y: 0.92, z: 0.62, rotX: 0 },
    frontLegL: { x: -0.14, y: -BODY_HALF_Y, z: 0.32, rotX: 0, rotZ: 0, scaleY: 1 },
    frontLegR: { x: 0.14, y: -BODY_HALF_Y, z: 0.32, rotX: 0, rotZ: 0, scaleY: 1 },
    backLegL: { x: -0.14, y: -BODY_HALF_Y, z: -0.32, rotX: 0, rotZ: 0, scaleY: 1 },
    backLegR: { x: 0.14, y: -BODY_HALF_Y, z: -0.32, rotX: 0, rotZ: 0, scaleY: 1 },
    tail: { x: 0, y: 0.74, z: -0.62, rotX: -0.5, rotY: 0 },
  };

  const seatedPose = {
    body: { y: 0.52 },
    head: { x: 0, y: 0.76, z: 0.56, rotX: 0.06 },
    frontLegL: { x: -0.14, y: -BODY_HALF_Y, z: 0.26, rotX: -0.32, rotZ: 0, scaleY: 0.62 },
    frontLegR: { x: 0.14, y: -BODY_HALF_Y, z: 0.26, rotX: -0.32, rotZ: 0, scaleY: 0.62 },
    backLegL: { x: -0.13, y: -BODY_HALF_Y + 0.02, z: -0.2, rotX: 1.28, rotZ: 0.1, scaleY: 0.95 },
    backLegR: { x: 0.13, y: -BODY_HALF_Y + 0.02, z: -0.2, rotX: 1.28, rotZ: -0.1, scaleY: 0.95 },
    tail: { x: 0, y: 0.58, z: -0.42, rotX: -0.15, rotY: 0.28 },
  };

  function applyPose(pose) {
    body.position.y = pose.body.y;
    head.position.set(pose.head.x, pose.head.y, pose.head.z);
    head.rotation.x = pose.head.rotX ?? 0;
    applyLegPose(frontLegL, pose.frontLegL);
    applyLegPose(frontLegR, pose.frontLegR);
    applyLegPose(backLegL, pose.backLegL);
    applyLegPose(backLegR, pose.backLegR);
    tail.position.set(pose.tail.x, pose.tail.y, pose.tail.z);
    tail.rotation.x = pose.tail.rotX;
    tail.rotation.y = pose.tail.rotY;
  }

  function applyLegPose(hip, pose) {
    hip.position.set(pose.x, pose.y, pose.z);
    hip.rotation.set(pose.rotX, 0, pose.rotZ);
    const mesh = hip.children[0];
    if (mesh) {
      mesh.scale.set(1, pose.scaleY, 1);
      mesh.position.y = -LEG_HALF * pose.scaleY;
    }
  }

  cat.userData.body = body;
  cat.userData.head = head;
  cat.userData.legs = { frontL: frontLegL, frontR: frontLegR, backL: backLegL, backR: backLegR };
  cat.userData.standingBodyY = standingPose.body.y;
  cat.userData.tail = tail;
  cat.userData.applyPose = (seated) => applyPose(seated ? seatedPose : standingPose);

  cat.traverse((child) => {
    if (child.isMesh) {
      child.renderOrder = child.material === glossMat ? 7 : 6;
    }
  });

  applyPose(seatedPose);

  return cat;
}

export class CatController {
  constructor(cat) {
    this.cat = cat;
    this._headWorld = new THREE.Vector3();
    this.position = new THREE.Vector3(0, 0, 14);
    this.facing = 0;
    this.walkPhase = 0;
    this.radius = 0.38;
    this.speed = 5.5;
    this.sprint = 9.5;
    this.turnSpeed = 2.75;
    this.verticalVelocity = 0;
    this.grounded = true;
    this.jumpForce = 7.2;
    this.gravity = 24;
    this.isMoving = false;
    this.isSeated = true;
    this.headBob = 0;
    this.viewPitch = -0.06;
    this.cat.userData.applyPose?.(true);
  }

  setSeated(seated) {
    if (this.isSeated === seated) return;
    this.isSeated = seated;
    this.cat.userData.applyPose?.(seated);
    if (!seated) {
      this.resetWalkPose();
    }
  }

  resetWalkPose() {
    const legs = this.cat.userData.legs;
    const body = this.cat.userData.body;
    const head = this.cat.userData.head;
    if (!legs || !this.cat.userData.applyPose) return;
    this.cat.userData.applyPose(false);
    legs.frontL.rotation.x = 0;
    legs.frontR.rotation.x = 0;
    legs.backL.rotation.x = 0;
    legs.backR.rotation.x = 0;
    if (head) {
      head.rotation.x = 0;
    }
  }

  applyWalkPose(phase) {
    const legs = this.cat.userData.legs;
    const body = this.cat.userData.body;
    if (!legs) return;

    const swing = 0.48;
    legs.frontL.rotation.x = Math.sin(phase) * swing;
    legs.frontR.rotation.x = Math.sin(phase + Math.PI) * swing;
    legs.backL.rotation.x = Math.sin(phase + Math.PI) * swing;
    legs.backR.rotation.x = Math.sin(phase) * swing;

    if (body) {
      const baseY = this.cat.userData.standingBodyY ?? 0.67;
      body.position.y = baseY + Math.abs(Math.sin(phase * 2)) * 0.022;
    }
  }

  wantsMove(input) {
    return input.moveForward || input.moveBack || input.moveLeft || input.moveRight;
  }

  getForward() {
    return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
  }

  getEyePosition(target = new THREE.Vector3()) {
    const forward = this.getForward();
    const bob = this.grounded && this.isMoving && !this.isSeated
      ? Math.sin(this.walkPhase * 2) * 0.02
      : 0;
    this.headBob = bob;
    this.cat.userData.head?.getWorldPosition(this._headWorld);
    return target.set(
      this._headWorld.x + forward.x * 0.14,
      this._headWorld.y + 0.05 + bob,
      this._headWorld.z + forward.z * 0.14
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

  update(dt, input, collisions, checkCollision, mode, viewYaw, curve, options = {}) {
    const { getGroundY, maxStepUp = 0.42 } = options;
    if (this.isSeated) {
      this.walkPhase += dt * 0.8;
    }

    const wish = new THREE.Vector3();
    let targetFacing = this.facing;

    if (mode === "firstPerson") {
      const forward = new THREE.Vector3(Math.sin(viewYaw), 0, Math.cos(viewYaw)).normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

      if (input.moveForward) wish.add(forward);
      if (input.moveBack) wish.sub(forward);
      if (input.moveRight) wish.add(right);
      if (input.moveLeft) wish.sub(right);
      targetFacing = viewYaw;
    } else if (curve) {
      const pathT = closestPathT(curve, this.position.x, this.position.z);
      const tangent = curve.getTangentAt(pathT).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
      this.roadFacing = Math.atan2(tangent.x, tangent.z);

      if (input.moveForward) wish.add(tangent);
      if (input.moveBack) wish.sub(tangent);
      if (input.moveRight) wish.add(normal);
      if (input.moveLeft) wish.sub(normal);

      if (input.moveForward) {
        targetFacing = this.roadFacing;
      } else if (wish.lengthSq() > 0) {
        targetFacing = Math.atan2(wish.x, wish.z);
      } else if (viewYaw !== undefined) {
        targetFacing = viewYaw + Math.PI;
      }
    } else if (viewYaw !== undefined) {
      const camForward = new THREE.Vector3(Math.sin(viewYaw), 0, Math.cos(viewYaw)).normalize();
      const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

      if (input.moveForward) wish.add(camForward);
      if (input.moveBack) wish.sub(camForward);
      if (input.moveRight) wish.add(camRight);
      if (input.moveLeft) wish.sub(camRight);

      if (wish.lengthSq() > 0) {
        targetFacing = Math.atan2(wish.x, wish.z);
      } else {
        targetFacing = viewYaw + Math.PI;
      }
    } else {
      if (input.moveForward) wish.z -= 1;
      if (input.moveBack) wish.z += 1;
      if (input.moveLeft) wish.x -= 1;
      if (input.moveRight) wish.x += 1;
    }

    if (this.isSeated && (this.wantsMove(input) || input.jumpQueued)) {
      this.setSeated(false);
    }

    const speed = input.sprint && wish.lengthSq() > 0 ? this.sprint : this.speed;
    const touchBoost = input.touchMode ? 1.22 : 1;
    const stepSpeed = speed * touchBoost;
    this.isMoving = false;

    if (wish.lengthSq() > 0) {
      wish.normalize();
      this.walkPhase += dt * (input.sprint ? 14 : 9) * (input.touchMode ? 1.15 : 1);
      this.isMoving = true;

      const step = wish.multiplyScalar(stepSpeed * dt);
      const nextX = this.position.x + step.x;
      const nextZ = this.position.z + step.z;
      if (!checkCollision(nextX, this.position.z, this.radius, collisions)) {
        this.position.x = nextX;
      }
      if (!checkCollision(this.position.x, nextZ, this.radius, collisions)) {
        this.position.z = nextZ;
      }
    }

    if (mode !== "firstPerson") {
      this.facing = lerpAngle(this.facing, targetFacing, 1 - Math.exp(-10 * dt));
    }

    if (input.jumpQueued && this.grounded) {
      this.verticalVelocity = this.jumpForce;
      this.grounded = false;
    }
    input.jumpQueued = false;

    this.verticalVelocity -= this.gravity * dt;
    this.position.y += this.verticalVelocity * dt;

    const groundY = getGroundY ? getGroundY(this.position.x, this.position.z) : 0;
    const stepTolerance = getGroundY ? maxStepUp : 0.05;
    const delta = groundY - this.position.y;

    if (!getGroundY) {
      if (this.position.y <= 0) {
        this.position.y = 0;
        this.verticalVelocity = 0;
        this.grounded = true;
      }
    } else if (this.verticalVelocity <= 0) {
      // Climb/stand on any surface within the step budget; fall only if it's far above.
      if (delta <= stepTolerance && delta >= -0.35) {
        this.position.y = groundY;
        this.verticalVelocity = 0;
        this.grounded = true;
      } else if (delta > stepTolerance) {
        this.grounded = false;
      } else if (this.position.y > groundY + 0.45) {
        this.grounded = false;
      }
    }

    this.cat.position.x = this.position.x;
    this.cat.position.z = this.position.z;
    this.cat.rotation.y = this.facing;
    this.cat.position.y = this.position.y;

    if (!this.isSeated && this.isMoving && this.grounded) {
      this.applyWalkPose(this.walkPhase);
    } else if (!this.isSeated) {
      this.resetWalkPose();
    }

    if (this.cat.userData.tail) {
      if (this.isSeated) {
        this.cat.userData.tail.rotation.y = 0.28 + Math.sin(this.walkPhase * 0.5) * 0.06;
      } else {
        const tailLift = this.grounded ? 0 : 0.5;
        this.cat.userData.tail.rotation.x = -0.5 - tailLift;
        this.cat.userData.tail.rotation.y = Math.sin(this.walkPhase * 1.2) * 0.35;
      }
    }
  }
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
