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

    if (isNewZone) {
      tag.textContent = zone.tag;
      title.textContent = zone.title;
      body.textContent = zone.body;
      links.innerHTML = "";
      zone.links.forEach((link) => {
        const a = document.createElement("a");
        a.href = link.href;
        a.textContent = link.label;
        a.target = link.href.startsWith("http") ? "_blank" : "_self";
        a.rel = "noopener noreferrer";
        links.appendChild(a);
      });
      panel.hidden = false;
      panel.style.animation = "none";
      void panel.offsetWidth;
      panel.style.animation = "";
    }

    options.onShow?.();
  }

  function hide() {
    if (!activeId) return;
    activeId = null;
    panel.hidden = true;
    options.onHide?.();
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
  let dragLook = false;
  let lastDragX = 0;
  let lastDragY = 0;
  let lockRequested = false;

  function isPanelOpen() {
    return options.isPanelOpen?.() ?? false;
  }

  function setCursorMode(mode) {
    state.cursorMode = mode;
    document.body.dataset.cursorMode = mode;

    if (mode === "free") {
      lockRequested = false;
      dragLook = false;
      releaseLock();
    }
  }

  function updateState() {
    state.forward = keys.has("w") || keys.has("arrowup");
    state.back = keys.has("s") || keys.has("arrowdown");
    state.left = keys.has("a") || keys.has("arrowleft");
    state.right = keys.has("d") || keys.has("arrowright");
    state.sprint = keys.has("shift");
  }

  function releaseLock() {
    lockRequested = false;
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
    dragLook = false;
  }

  function requestLock() {
    if (isPanelOpen()) return;
    if (document.pointerLockElement === canvas) return;

    lockRequested = true;
    canvas.requestPointerLock();
  }

  function enterLookMode() {
    if (isPanelOpen()) return;
    setCursorMode("look");
    options.onEngageView?.();
    requestLock();
  }

  function enterFreeMode() {
    setCursorMode("free");
  }

  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || e.target.closest(".zone-panel")) return;
    if (isPanelOpen()) return;

    dragLook = true;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    enterLookMode();
  });

  window.addEventListener("mouseup", () => {
    dragLook = false;
  });

  document.addEventListener("pointerlockchange", () => {
    state.pointerLocked = document.pointerLockElement === canvas;

    if (state.pointerLocked) {
      lockRequested = false;
      dragLook = false;
      state.cursorMode = "look";
      document.body.dataset.cursorMode = "look";
      return;
    }

    state.pointerLocked = false;
    lockRequested = false;
    dragLook = false;

    if (!isPanelOpen()) {
      state.cursorMode = "free";
      document.body.dataset.cursorMode = "free";
    }
  });

  document.addEventListener("pointerlockerror", () => {
    state.pointerLocked = false;
    lockRequested = false;
    dragLook = false;
    state.cursorMode = "free";
    document.body.dataset.cursorMode = "free";
  });

  document.addEventListener("mousemove", (e) => {
    if (state.pointerLocked) {
      state.lookX += e.movementX * sensitivity;
      state.lookY += e.movementY * sensitivity;
      return;
    }

    if (!dragLook || isPanelOpen()) return;
    state.lookX += (e.clientX - lastDragX) * sensitivity;
    state.lookY += (e.clientY - lastDragY) * sensitivity;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      enterFreeMode();
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
    enterFreeMode();
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
  state.enterLookMode = enterLookMode;
  state.enterFreeMode = enterFreeMode;
  state.isPanelOpen = isPanelOpen;

  return state;
}
