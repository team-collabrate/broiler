// The sound played when a bill is saved: `public/sounds/saved.mp3`, kept in the app's offline files so it also plays with
// no signal. A browser only lets sound start after a tap, so `primeSound` is called at the start of the Save/Print tap
// (it plays the file silently once); the real sound plays a moment later, once the sale is saved.

let sound: HTMLAudioElement | null = null;

const element = (): HTMLAudioElement => {
  sound ??= new Audio("/sounds/saved.mp3");
  sound.preload = "auto";
  return sound;
};

/** Unlocks sound for this page. Call it inside the tap handler. */
export function primeSound(): void {
  try {
    const audio = element();
    audio.muted = true;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      })
      .catch(() => {
        audio.muted = false;
      });
  } catch {
    // No sound is not worth a failed sale.
  }
}

/** Plays the saved-bill sound from the start. */
export function playSavedSound(): void {
  try {
    const audio = element();
    audio.muted = false;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  } catch {
    // Ignored on purpose.
  }
}
