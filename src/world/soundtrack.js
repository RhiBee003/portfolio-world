const STORAGE_KEY = "portfolio-world-muted";
const TRACK_URL = `${import.meta.env.BASE_URL}audio/soundtrack.mp3`;

/**
 * Looping ambient soundtrack with mute toggle.
 * Drop a legally obtained track at public/audio/soundtrack.mp3
 * (e.g. Outer Wilds OST from Andrew Prahlow’s Bandcamp).
 */
export function createSoundtrack(button) {
  const audio = new Audio(TRACK_URL);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.42;

  let muted = localStorage.getItem(STORAGE_KEY) === "1";
  let started = false;

  function syncButton() {
    if (!button) return;
    button.setAttribute("aria-pressed", muted ? "true" : "false");
    button.setAttribute("aria-label", muted ? "Unmute soundtrack" : "Mute soundtrack");
    button.dataset.muted = muted ? "true" : "false";
    button.title = muted ? "Unmute" : "Mute";
  }

  function applyMute() {
    audio.muted = muted;
    if (muted) {
      audio.pause();
    } else if (started) {
      audio.play().catch(() => {});
    }
    localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    syncButton();
  }

  function unlockAndPlay() {
    if (started) return;
    started = true;
    applyMute();
    if (!muted) {
      audio.play().catch(() => {
        // Autoplay can still fail; mute toggle or next gesture will retry.
        started = false;
      });
    }
  }

  function toggleMute() {
    muted = !muted;
    started = true;
    applyMute();
    if (!muted) {
      audio.play().catch(() => {});
    }
  }

  button?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMute();
  });

  syncButton();

  return {
    unlockAndPlay,
    toggleMute,
    get muted() {
      return muted;
    },
  };
}
