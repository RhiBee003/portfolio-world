export function createZoneUI() {
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

    if (isNewZone) {
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
      panel.style.animation = "none";
      void panel.offsetWidth;
      panel.style.animation = "";
    }
  }

  function hide() {
    if (!activeId) return;
    activeId = null;
    panel.hidden = true;
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

export function createInput(canvas, options = {}) {
  const keys = new Set();
  const state = {
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
    jumpQueued: false,
    pointerLocked: false,
    lookX: 0,
    lookY: 0,
    cursorMode: "free",
  };

  const sensitivity = 0.0024;

  function setCursorMode(mode) {
    state.cursorMode = mode;
    document.body.dataset.cursorMode = mode;
  }

  function updateState() {
    state.forward = keys.has("w") || keys.has("arrowup");
    state.back = keys.has("s") || keys.has("arrowdown");
    state.left = keys.has("a") || keys.has("arrowleft");
    state.right = keys.has("d") || keys.has("arrowright");
    state.sprint = keys.has("shift");
  }

  function releaseLock() {
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
  }

  function requestLock() {
    if (document.pointerLockElement === canvas) return;
    canvas.requestPointerLock();
  }

  function unlockCursor() {
    releaseLock();
    setCursorMode("free");
    options.onReleaseView?.();
  }

  function lockCursor() {
    if (state.pointerLocked) return;
    requestLock();
  }

  function toggleCursorLock() {
    if (state.pointerLocked) {
      unlockCursor();
    } else {
      lockCursor();
    }
  }

  canvas.addEventListener("click", (e) => {
    if (e.button !== 0 || e.target.closest(".zone-panel")) return;
    toggleCursorLock();
  });

  document.addEventListener("pointerlockchange", () => {
    state.pointerLocked = document.pointerLockElement === canvas;

    if (state.pointerLocked) {
      setCursorMode("look");
      options.onEngageView?.();
      return;
    }

    setCursorMode("free");
    options.onReleaseView?.();
  });

  document.addEventListener("pointerlockerror", () => {
    state.pointerLocked = false;
    setCursorMode("free");
    options.onReleaseView?.();
  });

  document.addEventListener("mousemove", (e) => {
    if (!state.pointerLocked) return;
    state.lookX += e.movementX * sensitivity;
    state.lookY += e.movementY * sensitivity;
  });

  window.addEventListener("keydown", (e) => {
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
    keys.add(e.key.toLowerCase());
    updateState();
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.key.toLowerCase());
    updateState();
  });

  window.addEventListener("blur", () => {
    keys.clear();
    updateState();
    unlockCursor();
  });

  document.body.dataset.cursorMode = "free";

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

  return state;
}
