import { useLanguage } from "../../i18n";
import "./SyncStatusBadge.css";

export type SyncStatus = "online" | "offline" | "pending";

const CONTENT: Record<SyncStatus, { icon: string; label: { en: string; ta: string } }> = {
  online: { icon: "●", label: { en: "Online", ta: "ஆன்லைன்" } },
  offline: { icon: "⚠", label: { en: "Offline — will sync", ta: "ஆஃப்லைன் — பின்னர் ஒத்திசைக்கும்" } },
  pending: { icon: "↻", label: { en: "Syncing…", ta: "ஒத்திசைக்கிறது…" } },
};

/** Shorter caption for the `compact` layout, which has room for a word, not
 *  a sentence — "Offline — will sync" cannot fit under an icon in a 76px
 *  sidebar column. The full explanation is still on the element via `title`
 *  and the `role="status"` text a screen reader announces. */
const COMPACT_LABEL: Record<SyncStatus, { en: string; ta: string }> = {
  online: { en: "Online", ta: "ஆன்லைன்" },
  offline: { en: "Offline", ta: "ஆஃப்லைன்" },
  pending: { en: "Sync…", ta: "ஒத்திசை" },
};

export interface SyncStatusBadgeProps {
  status: SyncStatus;
  /** Icon-over-caption instead of the inline pill, sized to sit in a narrow
   *  fixed-width column (the worker app's icon sidebar) rather than a
   *  header bar. Same colours and semantics, just a different shape. */
  compact?: boolean;
}

/** Design Brief §8 — never rely on color alone, always pair with icon + text. */
export function SyncStatusBadge({ status, compact = false }: SyncStatusBadgeProps) {
  const { language } = useLanguage();
  const { icon, label } = CONTENT[status];

  if (compact) {
    return (
      <span className={`sync-badge sync-badge--compact sync-badge--${status}`} role="status" title={label[language]}>
        <span className="sync-badge__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="sync-badge__caption">{COMPACT_LABEL[status][language]}</span>
      </span>
    );
  }

  return (
    <span className={`sync-badge sync-badge--${status}`} role="status">
      <span aria-hidden="true">{icon}</span>
      {label[language]}
    </span>
  );
}
