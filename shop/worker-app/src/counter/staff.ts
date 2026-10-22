// The workers who bill at the counter. The one picked here is written on every bill and printed beside the bill
// number. Change the names here (up to 40 letters each); a screen for the owner to edit them comes with the owner app.
export const STAFF_NAMES: readonly string[] = ["Worker A", "Worker B"];

const KEY = "broiler.staff";

/** The worker picked last time on this tablet, or the first one. */
export function readStaff(): string {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored !== null && STAFF_NAMES.includes(stored)) return stored;
  } catch {
    /* no storage: the first worker */
  }
  return STAFF_NAMES[0];
}

export function rememberStaff(name: string): void {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    /* the choice only lasts until the app closes */
  }
}
