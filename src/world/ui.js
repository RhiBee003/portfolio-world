export function createZoneUI() {
  const panel = document.getElementById("zone-panel");
  const closeBtn = document.getElementById("zone-close");
  const tag = document.getElementById("zone-tag");
  const title = document.getElementById("zone-title");
  const body = document.getElementById("zone-body");
  const links = document.getElementById("zone-links");

  let activeId = null;

  function show(zone) {
    if (!zone || activeId === zone.id) return;
    activeId = zone.id;
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

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  function hide() {
    activeId = null;
    panel.hidden = true;
  }

  closeBtn.addEventListener("click", hide);

  panel.addEventListener("mousedown", (e) => e.stopPropagation());
  panel.addEventListener("click", (e) => e.stopPropagation());

  return {
    show,
    hide,
    getActiveId: () => activeId,
  };
}

export function createInput(canvas) {
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
  };

  const sensitivity = 0.0024;

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
    const panel = document.getElementById("zone-panel");
    if (panel && !panel.hidden) return;
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  }

  canvas.addEventListener("click", (e) => {
    if (e.target.closest(".zone-panel")) return;
    requestLock();
  });

  document.addEventListener("pointerlockchange", () => {
    state.pointerLocked = document.pointerLockElement === canvas;
  });

  document.addEventListener("mousemove", (e) => {
    if (!state.pointerLocked) return;
    state.lookX += e.movementX * sensitivity;
    state.lookY += e.movementY * sensitivity;
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      releaseLock();
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
  });

  state.consumeLook = () => {
    const dx = state.lookX;
    const dy = state.lookY;
    state.lookX = 0;
    state.lookY = 0;
    return { dx, dy };
  };

  state.releaseLock = releaseLock;
  state.requestLock = requestLock;

  return state;
}
