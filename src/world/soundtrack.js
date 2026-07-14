const STORAGE_KEY = "portfolio-world-muted";
const TRACK_URL = `${import.meta.env.BASE_URL}audio/soundtrack.mp3`;

/**
 * Looping ambient soundtrack with mute toggle.
 * Drop a legally obtained track at public/audio/soundtrack.mp3
 * (e.g. Outer Wilds OST from Andrew Prahlow’s Bandcamp).
 *
 * Browsers block autoplay with sound on reload — we retry on any user
 * gesture until playback sticks (when not muted).
 */
export function createSoundtrack(button) {
  const audio = new Audio(TRACK_URL);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.42;

  let muted = localStorage.getItem(STORAGE_KEY) === "1";
  let playRequest = 0;

  function syncButton() {
    if (!button) return;
    button.setAttribute("aria-pressed", muted ? "true" : "false");
    button.setAttribute("aria-label", muted ? "Unmute soundtrack" : "Mute soundtrack");
    button.dataset.muted = muted ? "true" : "false";
    button.title = muted ? "Unmute" : "Mute";
  }

  function isPlaying() {
    return !audio.paused && !audio.ended && audio.currentTime > 0;
  }

  async function tryPlay() {
    localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    syncButton();

    if (muted) {
      audio.muted = true;
      audio.pause();
      return false;
    }

    audio.muted = false;
    const requestId = ++playRequest;
    try {
      if (audio.readyState < 2) {
        audio.load();
      }
      await audio.play();
      return requestId === playRequest;
    } catch {
      return false;
    }
  }

  function unlockAndPlay() {
    void tryPlay();
  }

  function toggleMute() {
    muted = !muted;
    void tryPlay();
  }

  function onUserGesture() {
    if (!muted && !isPlaying()) {
      void tryPlay();
    }
  }

  for (const eventName of ["pointerdown", "keydown", "touchstart", "click"]) {
    window.addEventListener(eventName, onUserGesture, { capture: true, passive: true });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !muted && !isPlaying()) {
      void tryPlay();
    }
  });

  button?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMute();
  });

  syncButton();
  // Warm the buffer; actual play still waits for a gesture.
  audio.load();

  return {
    unlockAndPlay,
    toggleMute,
    get muted() {
      return muted;
    },
  };
}
