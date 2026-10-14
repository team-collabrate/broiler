import { useState } from "react";
import { useLanguage } from "@kumbakonam/shared";
import { WorkerIcon } from "./SidebarIcons";
import { WORKER_NAMES } from "../hooks/useActiveWorkerName";
import "./WorkerNameSelect.css";

const STRINGS = {
  label: { en: "Worker", ta: "பணியாளர்" },
};

export interface WorkerNameSelectProps {
  value: string;
  onChange: (name: string) => void;
}

/** Small popover, not a full modal — picking who's on shift is a quick,
 *  frequent tap, not a decision that needs a backdrop and a confirm step. */
export function WorkerNameSelect({ value, onChange }: WorkerNameSelectProps) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div className="worker-select">
      {/* Icon-only, like Printer/Logout below it — "Gayathri" has no room
          as a caption in a 44px-wide button. The initial badge is a
          glance-check ("is it still me?"); the full name lives in the
          popover this opens, and in the tooltip. */}
      <button
        type="button"
        className="sidebar__icon-btn worker-select__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${STRINGS.label[language]}: ${value}`}
        title={`${STRINGS.label[language]}: ${value}`}
      >
        <WorkerIcon />
        <span className="worker-select__initial" aria-hidden="true">
          {value.charAt(0)}
        </span>
      </button>

      {open && (
        <>
          {/* Invisible, click-to-dismiss — not a darkened backdrop like the
              real modals use, this is a lightweight picker, not a decision
              that needs the rest of the screen to visually step back. */}
          <div className="worker-select__scrim" onClick={() => setOpen(false)} />
          <ul className="worker-select__menu" role="listbox" aria-label={STRINGS.label[language]}>
            {WORKER_NAMES.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === name}
                  className={`worker-select__option ${value === name ? "is-selected" : ""}`}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
