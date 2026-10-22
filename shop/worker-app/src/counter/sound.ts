// A short two-note chime when a bill is saved, made with the Web Audio API (no sound file to download or cache).
// A browser only lets sound start after a tap, so `primeSound` is called at the start of the Save/Print tap; the chime
// itself plays a moment later, once the sale is saved.

let context: AudioContext | null = null;

/** Wakes the audio engine. Call it inside the tap handler. */
export function primeSound(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    context ??= new Ctx();
    if (context.state === "suspended") void context.resume();
  } catch {
    // No sound is not worth a failed sale.
  }
}

/** A bright "ding-ding" (E6 then A6), about a third of a second. */
export function playSavedSound(): void {
  try {
    if (!context) return;
    const start = context.currentTime + 0.01;
    [
      { freq: 1318.5, at: 0 },
      { freq: 1760, at: 0.14 },
    ].forEach(({ freq, at }) => {
      const osc = context!.createOscillator();
      const gain = context!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start + at);
      gain.gain.exponentialRampToValueAtTime(0.5, start + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.22);
      osc.connect(gain).connect(context!.destination);
      osc.start(start + at);
      osc.stop(start + at + 0.25);
    });
  } catch {
    // Ignored on purpose.
  }
}
