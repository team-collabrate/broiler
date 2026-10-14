import { colorForWorkerName } from "@kumbakonam/shared";
import "./WorkerDot.css";

export interface WorkerDotProps {
  /** order.billedByName — undefined on an order taken before the shift picker existed. */
  name: string | undefined;
}

/** Who billed this, as a colour instead of writing the name on every row
 *  (see OrderHistoryRow) — the name is still there for anyone who needs
 *  it, in the title tooltip and the expanded detail below. */
export function WorkerDot({ name }: WorkerDotProps) {
  return (
    <span
      className="worker-dot"
      style={{ background: colorForWorkerName(name) }}
      title={name ?? ""}
      aria-hidden={!name}
      aria-label={name}
    />
  );
}
