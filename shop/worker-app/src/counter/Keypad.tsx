import { BACKSPACE_KEY } from "@kumbakonam/shared/core";
import { t } from "./strings";

interface Props {
  /** The bottom-left key: `.` for rates, `C` (clear) for rupee amounts, or `""` for none. */
  leftKey: "." | "C" | "";
  onKey: (key: string) => void;
  /** Taller keys where there is room. */
  tall?: boolean;
}

const LABELS: Record<string, string> = { [BACKSPACE_KEY]: t.keyDelete, ".": "dot", C: t.keyClear };

/** A big number pad for typing an amount or a rate. */
export function Keypad({ leftKey, onKey, tall = false }: Props) {
  const rows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [leftKey, "0", BACKSPACE_KEY],
  ];
  return (
    <div className={`ct-keypad${tall ? " is-tall" : ""}`}>
      {rows.flat().map((key, i) =>
        key === "" ? (
          <span key={`gap-${i}`} />
        ) : (
          <button key={key} type="button" className="ct-key" aria-label={LABELS[key] ?? key} onClick={() => onKey(key)}>
            {key}
          </button>
        ),
      )}
    </div>
  );
}
