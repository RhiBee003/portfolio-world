import * as THREE from "three";
import { controlHint } from "./ui.js";
import {
  SPACE_NEEDLE_POSITION,
  SPACE_NEEDLE_OBSERVATION_Y,
  SPACE_NEEDLE_CAR_FLOOR_Y,
  SPACE_NEEDLE_CAR_TOP_FLOOR_Y,
  SPACE_NEEDLE_CAR_FLOOR_THICKNESS,
  SPACE_NEEDLE_STAIR_AXIS_Z,
  SPACE_NEEDLE_SHAFT,
  SPACE_NEEDLE_SHAFT_RADIUS,
  SPACE_NEEDLE_DOOR_WIDTH,
  SPACE_NEEDLE_STAIR,
  SPACE_NEEDLE_CAR,
  SPACE_NEEDLE_DOOR_X,
  isInsideElevatorCar,
  isInElevatorDoorway,
} from "./spaceNeedleConfig.js";

const ELEVATOR_APPROACH_RADIUS = 7.5;

const RIDE_DURATION = 7.5;
const BOTTOM_COOLDOWN = 2.5;
const DOOR_WIDTH = SPACE_NEEDLE_DOOR_WIDTH;
const DOOR_HEIGHT = SPACE_NEEDLE_CAR.height;
const CAR_W = SPACE_NEEDLE_CAR.width;
const CAR_D = SPACE_NEEDLE_CAR.depth;
const CAR_H = SPACE_NEEDLE_CAR.height;
const CAR_HW = CAR_W / 2;
const CAR_HD = CAR_D / 2;
const PLATFORM_TOP_Y = 0.14;

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function glassMat(opacity = 0.34) {
  return new THREE.MeshStandardMaterial({
    color: 0xd8eaf8,
    transparent: true,
    opacity,
    roughness: 0.08,
    metalness: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

function frameMat() {
  return new THREE.MeshStandardMaterial({ color: 0xddd8d0, metalness: 0.28, roughness: 0.55 });
}

function createShaftShell(height) {
  const group = new THREE.Group();
  const doorArc = Math.PI / 2.4;
  const startAngle = doorArc / 2;
  const sweepAngle = Math.PI * 2 - doorArc;

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(SPACE_NEEDLE_SHAFT_RADIUS, SPACE_NEEDLE_SHAFT_RADIUS + 0.06, height, 20, 1, true, startAngle, sweepAngle),
    glassMat(0.18)
  );
  shell.position.y = height * 0.5;
  group.add(shell);

  const frameY = SPACE_NEEDLE_CAR_FLOOR_Y + DOOR_HEIGHT * 0.5;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, DOOR_WIDTH + 0.2), frameMat());
  lintel.position.set(SPACE_NEEDLE_SHAFT_RADIUS - 0.02, frameY + DOOR_HEIGHT * 0.5 - 0.05, 0);
  group.add(lintel);

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, DOOR_HEIGHT, 0.12), frameMat());
    post.position.set(SPACE_NEEDLE_SHAFT_RADIUS - 0.02, frameY, side * (DOOR_WIDTH * 0.5));
    group.add(post);
  }

  const sill = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, DOOR_WIDTH + 0.16), frameMat());
  sill.position.set(SPACE_NEEDLE_SHAFT_RADIUS - 0.04, SPACE_NEEDLE_CAR_FLOOR_Y + 0.04, 0);
  group.add(sill);

  return group;
}

function createCarShell() {
  const car = new THREE.Group();
  car.name = "elevator-car";

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(CAR_W, SPACE_NEEDLE_CAR_FLOOR_THICKNESS, CAR_D),
    new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.85, metalness: 0.12 })
  );
  floor.position.y = SPACE_NEEDLE_CAR_FLOOR_THICKNESS * 0.5;
  car.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(CAR_W - 0.04, 0.08, CAR_D - 0.04),
    new THREE.MeshStandardMaterial({ color: 0xf0eeea, roughness: 0.7 })
  );
  ceiling.position.y = CAR_H;
  car.add(ceiling);

  const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, CAR_H - 0.05, CAR_D - 0.1), glassMat(0.34));
  westWall.position.set(-CAR_HW + 0.04, CAR_H * 0.5 + 0.02, 0);
  car.add(westWall);

  const northWall = new THREE.Mesh(new THREE.BoxGeometry(CAR_W * 0.62, CAR_H - 0.05, 0.08), glassMat(0.34));
  northWall.position.set(-CAR_HW * 0.35, CAR_H * 0.5 + 0.02, -CAR_HD + 0.04);
  car.add(northWall);

  const southWall = new THREE.Mesh(new THREE.BoxGeometry(CAR_W * 0.62, CAR_H - 0.05, 0.08), glassMat(0.34));
  southWall.position.set(-CAR_HW * 0.35, CAR_H * 0.5 + 0.02, CAR_HD - 0.04);
  car.add(southWall);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, DOOR_WIDTH + 0.08), frameMat());
  lintel.position.set(CAR_HW - 0.02, DOOR_HEIGHT + 0.06, 0);
  car.add(lintel);

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, DOOR_HEIGHT, 0.1), frameMat());
    post.position.set(CAR_HW - 0.08, DOOR_HEIGHT * 0.5 + 0.05, side * (DOOR_WIDTH * 0.5));
    car.add(post);

    const openDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, DOOR_HEIGHT * 0.96, DOOR_WIDTH * 0.46),
      glassMat(0.28)
    );
    openDoor.position.set(CAR_HW - 0.14, DOOR_HEIGHT * 0.5 + 0.05, side * (DOOR_WIDTH * 0.78));
    car.add(openDoor);
  }

  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 0.06),
    new THREE.MeshStandardMaterial({
      color: 0x66ff99,
      emissive: 0x22aa55,
      emissiveIntensity: 0.75,
    })
  );
  indicator.position.set(CAR_HW - 0.2, DOOR_HEIGHT + 0.22, 0);
  car.add(indicator);

  const entryMat = new THREE.MeshStandardMaterial({
    color: 0x88ffaa,
    emissive: 0x338855,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const entryGlow = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_WIDTH, DOOR_HEIGHT), entryMat);
  entryGlow.position.set(CAR_HW - 0.04, DOOR_HEIGHT * 0.5 + 0.05, 0);
  entryGlow.rotation.y = Math.PI / 2;
  car.add(entryGlow);

  car.userData.indicator = indicator;

  return car;
}

export function createSpaceNeedleElevator(needleGroup) {
  const root = new THREE.Group();
  root.position.set(SPACE_NEEDLE_SHAFT.x, 0, SPACE_NEEDLE_SHAFT.z);

  const shaftHeight = SPACE_NEEDLE_OBSERVATION_Y + 1.6;
  const shaft = createShaftShell(shaftHeight);
  root.add(shaft);

  const railGeo = new THREE.BoxGeometry(0.08, shaftHeight, 0.08);
  const railMat = new THREE.MeshStandardMaterial({ color: 0xb0aca4, metalness: 0.35, roughness: 0.55 });
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(-CAR_HW * 0.65, shaftHeight * 0.5, side * (CAR_HD - 0.08));
    root.add(rail);
  }

  const car = createCarShell();
  car.position.y = SPACE_NEEDLE_CAR_FLOOR_Y;
  root.add(car);

  const indicator = car.userData.indicator;

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.14, SPACE_NEEDLE_STAIR.width + 0.2),
    new THREE.MeshStandardMaterial({ color: 0x9e9890, roughness: 0.92, metalness: 0.05 })
  );
  platform.position.set(
    SPACE_NEEDLE_STAIR.platformX - SPACE_NEEDLE_SHAFT.x - 0.55,
    PLATFORM_TOP_Y - 0.07,
    0
  );
  platform.castShadow = true;
  platform.receiveShadow = true;
  root.add(platform);

  root.frustumCulled = false;
  needleGroup.add(root);

  return { root, car, indicator, platform };
}

export class SpaceNeedleElevatorController {
  constructor(system) {
    this.system = system;
    this.state = "idle";
    this.rideT = 0;
    this.carLocalY = SPACE_NEEDLE_CAR_FLOOR_Y;
    this.cooldown = 0;
    this.wasInsideCar = false;
    this.passenger = false;
    this._worldPos = new THREE.Vector3();
  }

  getState() {
    return {
      carY: this.carLocalY,
      atTop: this.state === "atTop",
      moving: this.state === "ascending" || this.state === "descending",
    };
  }

  isRiding() {
    return this.state === "ascending" || this.state === "descending";
  }

  locksMovement() {
    return this.isRiding() || this.passenger;
  }

  getCatLocalXZ(cat) {
    return {
      lx: cat.position.x - SPACE_NEEDLE_POSITION.x,
      lz: cat.position.z - SPACE_NEEDLE_POSITION.z,
    };
  }

  isCatInsideCar(cat) {
    const { lx, lz } = this.getCatLocalXZ(cat);
    return isInsideElevatorCar(lx, lz, cat.position.y, this.carLocalY);
  }

  consumeBoardInput(input) {
    if (input.jumpQueued) input.jumpQueued = false;
  }

  consumeDepartInput(input) {
    if (input.interactQueued) input.interactQueued = false;
  }

  wantsBoard(input) {
    return input.jumpQueued;
  }

  wantsDepart(input) {
    return input.interactQueued;
  }

  isOnElevatorStairs(cat) {
    const { lx, lz } = this.getCatLocalXZ(cat);
    return (
      lx >= SPACE_NEEDLE_STAIR.entryX0 - 1.2 &&
      lx <= SPACE_NEEDLE_STAIR.platformX + 2.8 &&
      Math.abs(lz - SPACE_NEEDLE_STAIR_AXIS_Z) <= SPACE_NEEDLE_STAIR.width / 2 + 0.55
    );
  }

  canBoard(cat) {
    if (this.isRiding()) return false;
    if (this.passenger) return false;
    if (this.cooldown > 0) return false;
    if (this.state !== "idle" && this.state !== "atTop") return false;
    if (this.isCatInsideCar(cat)) return true;

    const { lx, lz } = this.getCatLocalXZ(cat);
    const walkY = this.carLocalY + SPACE_NEEDLE_CAR_FLOOR_THICKNESS;

    if (isInElevatorDoorway(lx, lz, 0.55)) {
      return Math.abs(cat.position.y - walkY) < 0.85;
    }

    // From the entry stairs at the bottom — Space snaps you into the cab.
    if (this.state === "idle" && this.isOnElevatorStairs(cat)) {
      return cat.position.y < walkY + 0.7;
    }

    return false;
  }

  canDepart(cat) {
    if (this.isRiding()) return false;
    if (!this.passenger) return false;
    if (this.state !== "idle" && this.state !== "atTop") return false;
    return this.isCatInsideCar(cat);
  }

  isNearElevator(cat) {
    if (this.isRiding()) return false;

    const { lx, lz } = this.getCatLocalXZ(cat);

    if (isInElevatorDoorway(lx, lz, 2.4)) return true;
    if (this.isOnElevatorStairs(cat)) return true;

    const dx = lx - SPACE_NEEDLE_DOOR_X;
    const dz = lz - SPACE_NEEDLE_STAIR_AXIS_Z;
    if (Math.sqrt(dx * dx + dz * dz) < ELEVATOR_APPROACH_RADIUS) return true;

    return (
      lx >= SPACE_NEEDLE_STAIR.entryX0 - 3.2 &&
      lx <= SPACE_NEEDLE_STAIR.platformX + 2.4 &&
      Math.abs(lz - SPACE_NEEDLE_STAIR_AXIS_Z) <= SPACE_NEEDLE_STAIR.width + 1.4
    );
  }

  formatContextHint(title, message) {
    return { title, message };
  }

  getContextHint(cat) {
    if (this.canDepart(cat)) {
      if (this.state === "atTop") {
        return this.formatContextHint("Space Needle elevator", `${controlHint("ride")} ride back down`);
      }
      return this.formatContextHint("Space Needle elevator", `${controlHint("ride")} ride to the observation deck`);
    }
    if (this.canBoard(cat)) {
      return this.formatContextHint("Space Needle elevator", `${controlHint("board")} board the elevator`);
    }
    if (this.isNearElevator(cat)) {
      return this.formatContextHint(
        "Space Needle elevator",
        `${controlHint("board")} board · ${controlHint("ride")} ride up or down`
      );
    }
    return null;
  }

  tryBoard(cat, input) {
    if (!this.wantsBoard(input)) return false;
    if (!this.canBoard(cat)) {
      // Eat Space on the approach so it doesn't jump you off the stairs.
      if (this.isNearElevator(cat) && (this.state === "idle" || this.state === "atTop")) {
        this.consumeBoardInput(input);
      }
      return false;
    }
    this.consumeBoardInput(input);
    this.passenger = true;
    this.applyCatToCar(cat, { snapFacing: true });
    return true;
  }

  tryDepart(cat, input) {
    if (!this.canDepart(cat) || !this.wantsDepart(input)) return false;
    this.consumeDepartInput(input);
    if (this.state === "idle") {
      this.state = "ascending";
      this.rideT = 0;
      this.applyCatToCar(cat);
      return true;
    }
    if (this.state === "atTop") {
      this.state = "descending";
      this.rideT = 0;
      this.applyCatToCar(cat);
      return true;
    }
    return false;
  }

  syncCar() {
    this.system.car.position.y = this.carLocalY;
    const lit = this.state === "ascending" || this.state === "descending";
    const indicator = this.system.indicator;
    if (indicator) {
      indicator.material.color.setHex(lit ? 0xffcc66 : 0x66ff99);
      indicator.material.emissive.setHex(lit ? 0xaa7722 : 0x22aa55);
    }
  }

  applyCatToCar(cat, { snapFacing = false } = {}) {
    this.system.car.updateMatrixWorld(true);
    this.system.car.getWorldPosition(this._worldPos);
    // Floor slab top = car group Y + thickness (floor mesh sits from 0→thickness).
    const walkY = this.carLocalY + SPACE_NEEDLE_CAR_FLOOR_THICKNESS;
    cat.position.set(this._worldPos.x, walkY, this._worldPos.z);
    cat.cat.position.set(cat.position.x, cat.position.y, cat.position.z);
    cat.grounded = true;
    cat.verticalVelocity = 0;
    cat.isMoving = false;
    cat.setSeated(false);
    // Keep player look direction free while riding — only snap body on first board.
    if (snapFacing) {
      const yaw = this.system.car.rotation.y;
      cat.facing = yaw;
      cat.cat.rotation.y = yaw;
    } else {
      cat.cat.rotation.y = cat.facing;
    }
    cat.resetWalkPose();
  }

  update(dt, cat, input) {
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - dt);
    }

    const inside = this.isCatInsideCar(cat);
    if (!inside) {
      this.wasInsideCar = false;
      if (this.passenger && !this.isRiding()) {
        this.passenger = false;
      }
    }

    if (this.state === "idle") {
      this.carLocalY = SPACE_NEEDLE_CAR_FLOOR_Y;
      this.syncCar();

      if (this.tryBoard(cat, input)) return true;
      if (this.tryDepart(cat, input)) return true;
      this.wasInsideCar = inside;
      return this.passenger;
    }

    if (this.state === "ascending") {
      this.rideT += dt / RIDE_DURATION;
      const eased = easeInOut(Math.min(1, this.rideT));
      this.carLocalY = THREE.MathUtils.lerp(
        SPACE_NEEDLE_CAR_FLOOR_Y,
        SPACE_NEEDLE_CAR_TOP_FLOOR_Y,
        eased
      );
      this.syncCar();
      if (this.passenger) {
        this.applyCatToCar(cat);
      }
      if (this.rideT >= 1) {
        this.state = "atTop";
        this.carLocalY = SPACE_NEEDLE_CAR_TOP_FLOOR_Y;
        this.syncCar();
        this.rideT = 0;
        if (this.passenger) this.applyCatToCar(cat);
      }
      return true;
    }

    if (this.state === "atTop") {
      this.carLocalY = SPACE_NEEDLE_CAR_TOP_FLOOR_Y;
      this.syncCar();
      if (this.passenger) this.applyCatToCar(cat);
      if (this.tryDepart(cat, input)) return true;
      this.tryBoard(cat, input);
      this.wasInsideCar = inside;
      return this.passenger;
    }

    if (this.state === "descending") {
      this.rideT += dt / RIDE_DURATION;
      const eased = easeInOut(Math.min(1, this.rideT));
      this.carLocalY = THREE.MathUtils.lerp(
        SPACE_NEEDLE_CAR_TOP_FLOOR_Y,
        SPACE_NEEDLE_CAR_FLOOR_Y,
        eased
      );
      this.syncCar();
      if (this.passenger && inside) {
        this.applyCatToCar(cat);
      }
      if (this.rideT >= 1) {
        this.state = "idle";
        this.carLocalY = SPACE_NEEDLE_CAR_FLOOR_Y;
        this.syncCar();
        this.passenger = false;
        this.cooldown = BOTTOM_COOLDOWN;
        this.wasInsideCar = inside;
      }
      return true;
    }

    return false;
  }
}
