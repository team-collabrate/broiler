import { WORKER_NAMES, colorForWorkerName } from "@kumbakonam/shared";
import "./WorkerLegend.css";

/** Maps the dot colour on each order history row (see WorkerDot) back to a
 *  name, once, rather than relying on the row's own title tooltip every
 *  time — sits right above the list it explains. */
export function WorkerLegend() {
  return (
    <div className="worker-legend">
      {WORKER_NAMES.map((name) => (
        <span key={name} className="worker-legend__item">
          <span className="worker-legend__dot" style={{ background: colorForWorkerName(name) }} aria-hidden="true" />
          {name}
        </span>
      ))}
    </div>
  );
}
