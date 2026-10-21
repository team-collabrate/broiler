import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";

const ROW = 48;
/** Rows showing at once, like the iOS alarm picker: the middle one is the value. */
const VISIBLE_ROWS = 5;

interface Props {
  values: string[];
  /** The row in the middle. */
  index: number;
  onChange: (index: number) => void;
  /** Small caption over the wheel, such as the unit. */
  caption?: string;
  ariaLabel: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/**
 * A scroll wheel like the iOS alarm picker. It is a plain scrolling column with snap points, so on the tablet
 * the finger gets the system's own momentum and settles softly on a row, never a twitchy custom gesture. Tap a
 * row to jump to it. The value is whichever row sits in the highlighted middle band. A mouse can drag it too (for
 * checking on a laptop).
 */
export function WheelPicker({ values, index, onChange, caption, ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  /** The row last reported or last scrolled to, so a value we reported ourselves never scrolls the wheel again. */
  const reported = useRef(index);
  const drag = useRef<{ y: number; top: number; moved: boolean } | null>(null);

  // Start on the right row, with no animation.
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = index * ROW;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow a value set from outside (the −/+ buttons, an edit, a reset) with a short glide.
  useEffect(() => {
    if (index === reported.current) return;
    reported.current = index;
    ref.current?.scrollTo({ top: index * ROW, behavior: "smooth" });
  }, [index]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const next = clamp(Math.round(el.scrollTop / ROW), 0, values.length - 1);
    if (next !== reported.current) {
      reported.current = next;
      onChange(next);
    }
  };

  const goTo = (i: number) => ref.current?.scrollTo({ top: clamp(i, 0, values.length - 1) * ROW, behavior: "smooth" });

  // A mouse cannot scroll by dragging, so a drag moves the column by hand (a finger needs none of this).
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    drag.current = { y: e.clientY, top: ref.current.scrollTop, moved: false };
    ref.current.setPointerCapture(e.pointerId);
    ref.current.style.scrollSnapType = "none";
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !ref.current) return;
    if (Math.abs(e.clientY - d.y) > 4) d.moved = true;
    ref.current.scrollTop = d.top - (e.clientY - d.y);
  };
  const onPointerUp = () => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    drag.current = null;
    el.style.scrollSnapType = "";
    goTo(Math.round(el.scrollTop / ROW));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      goTo(index + (e.key === "ArrowDown" ? 1 : -1));
    }
  };

  return (
    <div className="ct-wheel">
      {caption ? <span className="ct-wheel__caption">{caption}</span> : null}
      <div className="ct-wheel__frame" style={{ height: ROW * VISIBLE_ROWS }}>
        <div className="ct-wheel__band" style={{ top: ROW * Math.floor(VISIBLE_ROWS / 2), height: ROW }} aria-hidden="true" />
        <div
          ref={ref}
          className="ct-wheel__scroller"
          role="spinbutton"
          tabIndex={0}
          aria-label={ariaLabel}
          aria-valuenow={index}
          aria-valuetext={values[index]}
          aria-valuemin={0}
          aria-valuemax={values.length - 1}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div style={{ height: ROW * Math.floor(VISIBLE_ROWS / 2) }} aria-hidden="true" />
          {values.map((label, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              className={`ct-wheel__row${i === index ? " is-on" : ""}`}
              style={{ height: ROW }}
              onClick={() => {
                if (drag.current?.moved) return;
                goTo(i);
              }}
            >
              {label}
            </button>
          ))}
          <div style={{ height: ROW * Math.floor(VISIBLE_ROWS / 2) }} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
