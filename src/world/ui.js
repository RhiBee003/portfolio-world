export function createBioBar() {
  const bar = document.getElementById("bio-bar");
  const collapseBtn = document.getElementById("bio-collapse");
  const dock = document.getElementById("ui-dock");
  if (!bar || !collapseBtn) return;

  const DOCK_BOTTOM = 20;
  const DESCEND_MS = 1150;

  let entranceDone = false;

  function dockAtBottom() {
    bar.classList.remove("is-entering");
    bar.style.position = "";
    bar.style.left = "";
    bar.style.top = "";
    bar.style.bottom = "";
    bar.style.transform = "";
    bar.classList.add("is-docked", "can-resize");
  }

  function setCollapsed(collapsed) {
    bar.classList.toggle("is-collapsed", collapsed);
    collapseBtn.textContent = collapsed ? "+" : "−";
    collapseBtn.setAttribute("aria-label", collapsed ? "Expand bio" : "Collapse bio");
    if (!collapsed) {
      dockAtBottom();
    }
  }

  collapseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!bar.classList.contains("can-resize")) return;
    const zonePanel = document.getElementById("zone-panel");
    if (zonePanel && !zonePanel.hidden) return;
    setCollapsed(!bar.classList.contains("is-collapsed"));
  });

  bar.addEventListener("mousedown", (e) => e.stopPropagation());
  bar.addEventListener("click", (e) => e.stopPropagation());

  function playDescent() {
    bar.classList.remove("is-collapsed", "is-docked", "can-resize");
    bar.classList.add("is-entering");
    bar.style.top = "0px";

    requestAnimationFrame(() => {
      const height = bar.getBoundingClientRect().height;
      const dockBottom = dock ? parseFloat(getComputedStyle(dock).bottom) || DOCK_BOTTOM : DOCK_BOTTOM;
      const endTop = Math.max(0, window.innerHeight - height - dockBottom);

      const anim = bar.animate(
        [
          { top: "0px", transform: "translateX(-50%)" },
          { top: `${endTop}px`, transform: "translateX(-50%)" },
        ],
        { duration: DESCEND_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
      );

      anim.onfinish = () => {
        anim.cancel();
        entranceDone = true;
        dockAtBottom();
      };
    });
  }

  window.addEventListener("resize", () => {
    if (bar.classList.contains("is-docked") && !bar.classList.contains("is-collapsed")) {
      dockAtBottom();
    }
  });

  return {
    playEntrance: playDescent,
    isEntranceDone: () => entranceDone,
    hideForZone() {
      bar.classList.remove("is-entering");
      bar.style.position = "";
      bar.style.left = "";
      bar.style.top = "";
      bar.style.bottom = "";
      bar.style.transform = "";
      setCollapsed(true);
      bar.hidden = true;
    },
    restoreAfterZone() {
      if (!bar.classList.contains("can-resize")) return;
      bar.hidden = false;
    },
  };
}

export function createContextHint() {
  const el = document.getElementById("context-hint");
  if (!el) return { show() {}, hide() {} };

  return {
    show(hint) {
      if (!hint) return;
      if (typeof hint === "string") {
        el.innerHTML = `<span class="context-hint-body">${hint}</span>`;
      } else {
        el.innerHTML = `<span class="context-hint-body">${hint.message}</span><span class="context-hint-title">${hint.title}</span>`;
      }
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
      el.innerHTML = "";
    },
  };
}

export function createZoneUI(options = {}) {
  const panel = document.getElementById("zone-panel");
  const closeBtn = document.getElementById("zone-close");
  const tag = document.getElementById("zone-tag");
  const title = document.getElementById("zone-title");
  const body = document.getElementById("zone-body");
  const links = document.getElementById("zone-links");

  let activeId = null;

  function isOpen() {
    return Boolean(panel && !panel.hidden);
  }

  function show(zone) {
    if (!zone) return;

    const isNewZone = activeId !== zone.id;
    activeId = zone.id;

    tag.textContent = zone.tag;
    title.textContent = zone.title;
    body.textContent = zone.body;
    links.innerHTML = "";
    zone.links.forEach((link) => {
      const a = document.createElement("a");
      a.href = link.href;
      a.textContent = link.label;
      const isPdf = link.href.toLowerCase().includes(".pdf");
      a.target = link.href.startsWith("http") || isPdf ? "_blank" : "_self";
      a.rel = "noopener noreferrer";
      links.appendChild(a);
    });

    panel.hidden = false;
    panel.style.animation = "";

    if (isNewZone) {
      options.onOpen?.();
    }
  }

  function hide() {
    if (!activeId && panel.hidden) return;
    const wasOpen = Boolean(activeId);
    activeId = null;
    panel.hidden = true;
    panel.style.animation = "";
    if (wasOpen) {
      options.onClose?.();
    }
  }

  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    hide();
  });

  panel.addEventListener("mousedown", (e) => e.stopPropagation());
  panel.addEventListener("click", (e) => e.stopPropagation());

  return {
    show,
    hide,
    isOpen,
    getActiveId: () => activeId,
  };
}

export let controlMode = null;

export function getControlMode() {
  return controlMode;
}

export function prefersTouchControls() {
  return controlMode === "mobile";
}

/** Board / ride copy for keyboard vs tap. */
export function controlHint(kind) {
  const touch = prefersTouchControls();
  if (kind === "board") return touch ? "<b>Tap</b>" : "<kbd>Space</kbd>";
  if (kind === "ride") return touch ? "<b>Double-tap</b>" : "<kbd>E</kbd>";
  return "";
}

export function createInput(canvas, options = {}) {
  const keys = new Set();
  const touchMove = { active: false, x: 0, y: 0 };
  const state = {
    moveForward: false,
    moveBack: false,
    moveLeft: false,
    moveRight: false,
    lookUp: false,
    lookDown: false,
    lookLeft: false,
    lookRight: false,
    sprint: false,
    jumpQueued: false,
    interactQueued: false,
    pointerLocked: false,
    touchMode: false,
    lookEngaged: false,
    lookX: 0,
    lookY: 0,
    cursorMode: "free",
  };

  const sensitivity = 0.0024;
  let wantsPointerLock = false;
  let relockQueued = false;
  let lastTapAt = 0;

  function setCursorMode(mode) {
    state.cursorMode = mode;
    document.body.dataset.cursorMode = mode;
  }

  function applyControlMode(mode) {
    controlMode = mode === "mobile" ? "mobile" : "desktop";
    state.touchMode = controlMode === "mobile";
    document.body.classList.toggle("control-mobile", state.touchMode);
    document.body.classList.toggle("control-desktop", !state.touchMode);
    document.body.classList.toggle("touch-ui", state.touchMode);

    if (state.touchMode) {
      wantsPointerLock = false;
      releaseLock();
      state.lookEngaged = false;
      setCursorMode("free");
      options.onReleaseView?.();
    } else {
      setCursorMode(state.pointerLocked ? "look" : "free");
    }
  }

  function updateState() {
    const stickThreshold = 0.22;
    const stickForward = touchMove.active && touchMove.y < -stickThreshold;
    const stickBack = touchMove.active && touchMove.y > stickThreshold;
    const stickLeft = touchMove.active && touchMove.x < -stickThreshold;
    const stickRight = touchMove.active && touchMove.x > stickThreshold;

    if (state.touchMode) {
      state.moveForward = stickForward;
      state.moveBack = stickBack;
      state.moveLeft = stickLeft;
      state.moveRight = stickRight;
      state.lookUp = false;
      state.lookDown = false;
      state.lookLeft = false;
      state.lookRight = false;
      state.sprint = touchMove.active && Math.hypot(touchMove.x, touchMove.y) > 0.72;
      return;
    }

    state.moveForward = keys.has("KeyW");
    state.moveBack = keys.has("KeyS") || keys.has("Backspace");
    state.moveLeft = keys.has("KeyA");
    state.moveRight = keys.has("KeyD");
    state.lookUp = keys.has("ArrowUp");
    state.lookDown = keys.has("ArrowDown");
    state.lookLeft = keys.has("ArrowLeft");
    state.lookRight = keys.has("ArrowRight");
    state.sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
  }

  function releaseLock() {
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
  }

  function requestLock() {
    if (state.touchMode) return;
    if (document.pointerLockElement === canvas) return;
    canvas.requestPointerLock?.();
  }

  function unlockCursor() {
    wantsPointerLock = false;
    relockQueued = false;
    releaseLock();
    if (!state.touchMode) {
      state.lookEngaged = false;
      setCursorMode("free");
      options.onReleaseView?.();
    }
  }

  function lockCursor() {
    if (state.touchMode) return;
    if (state.pointerLocked) return;
    wantsPointerLock = true;
    requestLock();
  }

  function queueRelock() {
    if (state.touchMode) return;
    if (!wantsPointerLock || state.pointerLocked || relockQueued) return;
    relockQueued = true;
    requestAnimationFrame(() => {
      relockQueued = false;
      if (wantsPointerLock && !state.pointerLocked) {
        requestLock();
      }
    });
  }

  function toggleCursorLock() {
    if (state.touchMode) return;
    if (state.pointerLocked) {
      unlockCursor();
    } else {
      lockCursor();
    }
  }

  canvas.addEventListener("click", (e) => {
    if (e.button !== 0 || e.target.closest(".zone-panel")) return;
    if (options.onCanvasClick?.(e)) return;
    if (state.touchMode) return;
    toggleCursorLock();
  });

  document.addEventListener("pointerlockchange", () => {
    state.pointerLocked = document.pointerLockElement === canvas;

    if (state.pointerLocked) {
      wantsPointerLock = true;
      state.lookEngaged = true;
      setCursorMode("look");
      options.onEngageView?.();
      return;
    }

    if (!state.touchMode) {
      state.lookEngaged = false;
      setCursorMode("free");
      options.onReleaseView?.();
    }

    if (wantsPointerLock) {
      queueRelock();
    }
  });

  document.addEventListener("pointerlockerror", () => {
    state.pointerLocked = false;
    if (!state.touchMode) {
      setCursorMode("free");
      options.onReleaseView?.();
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (!state.pointerLocked || state.touchMode) return;
    state.lookX += e.movementX * sensitivity;
    state.lookY += e.movementY * sensitivity;
  });

  window.addEventListener("keydown", (e) => {
    if (state.touchMode || !controlMode) return;
    if (e.code === "Escape") {
      unlockCursor();
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      if (!e.repeat) {
        state.jumpQueued = true;
      }
      return;
    }
    if (e.code === "KeyE") {
      e.preventDefault();
      if (!e.repeat) {
        state.interactQueued = true;
      }
      return;
    }
    if (e.code.startsWith("Arrow")) {
      e.preventDefault();
    }
    if (e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD" || e.code === "Backspace") {
      e.preventDefault();
    }
    keys.add(e.code);
    updateState();
  });
  window.addEventListener("keyup", (e) => {
    if (state.touchMode) return;
    keys.delete(e.code);
    updateState();
  });

  window.addEventListener("blur", () => {
    keys.clear();
    touchMove.active = false;
    touchMove.x = 0;
    touchMove.y = 0;
    updateState();
    if (!state.touchMode) unlockCursor();
  });

  // Mobile: drag anywhere on canvas to move; tap / double-tap for actions.
  let movePointerId = null;
  let moveOriginX = 0;
  let moveOriginY = 0;
  let moveDragged = false;
  const MOVE_RADIUS = 72;
  const TAP_SLOP = 14;
  const DOUBLE_TAP_MS = 340;

  function uiBlocksTouch(target) {
    return Boolean(
      target?.closest?.(
        ".ui-dock, .controls-key, .zone-panel, .bio-bar, .mode-select, .loading, button, a"
      )
    );
  }

  function setTouchStickFromOffset(dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, MOVE_RADIUS / len);
    touchMove.x = (dx * scale) / MOVE_RADIUS;
    touchMove.y = (dy * scale) / MOVE_RADIUS;
    touchMove.active = true;
    updateState();
  }

  function clearTouchStick() {
    touchMove.active = false;
    touchMove.x = 0;
    touchMove.y = 0;
    updateState();
  }

  function handleMobileTap(clientX, clientY) {
    const synthetic = { clientX, clientY, button: 0, target: canvas };
    if (options.onCanvasClick?.(synthetic)) return;

    const now = performance.now();
    if (now - lastTapAt < DOUBLE_TAP_MS) {
      state.interactQueued = true;
      lastTapAt = 0;
      return;
    }
    lastTapAt = now;
    state.jumpQueued = true;
  }

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (!state.touchMode) return;
      if (uiBlocksTouch(e.target)) return;
      if (movePointerId !== null) return;
      e.preventDefault();
      movePointerId = e.pointerId;
      moveOriginX = e.clientX;
      moveOriginY = e.clientY;
      moveDragged = false;
      canvas.setPointerCapture?.(e.pointerId);
    },
    { passive: false }
  );

  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerId !== movePointerId || !state.touchMode) return;
      const dx = e.clientX - moveOriginX;
      const dy = e.clientY - moveOriginY;
      if (!moveDragged && Math.hypot(dx, dy) > TAP_SLOP) {
        moveDragged = true;
      }
      if (!moveDragged) return;
      e.preventDefault();
      setTouchStickFromOffset(dx, dy);
    },
    { passive: false }
  );

  const endMobilePointer = (e) => {
    if (e.pointerId !== movePointerId) return;
    const wasDrag = moveDragged;
    const x = e.clientX;
    const y = e.clientY;
    movePointerId = null;
    moveDragged = false;
    clearTouchStick();
    if (!wasDrag && state.touchMode) {
      handleMobileTap(x, y);
    }
  };
  canvas.addEventListener("pointerup", endMobilePointer);
  canvas.addEventListener("pointercancel", endMobilePointer);

  state.setControlMode = applyControlMode;
  state.consumeLook = () => {
    const dx = state.lookX;
    const dy = state.lookY;
    state.lookX = 0;
    state.lookY = 0;
    return { dx, dy };
  };

  state.releaseLock = releaseLock;
  state.requestLock = requestLock;
  state.lockCursor = lockCursor;
  state.unlockCursor = unlockCursor;
  state.toggleCursorLock = toggleCursorLock;
  state.isLookActive = () => state.pointerLocked || state.lookEngaged;

  setCursorMode("free");
  return state;
}
