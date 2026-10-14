/**
 * Hand-drawn flat SVG illustrations for the menu — no photos, no Storage.
 * A handful of reusable base shapes (glass, mug, filter-coffee davara set,
 * fried snacks, etc.) parameterized per item, keyed by MenuItem.name.
 */
import type { ReactElement } from "react";

// --- reusable base shapes --------------------------------------------------

type Garnish = "lemon" | "orange" | "grape" | "watermelon" | "mango" | "leaf" | "ginger" | "almond" | "none";

function GarnishMark({ kind }: { kind: Garnish }) {
  switch (kind) {
    case "lemon":
      return (
        <g>
          <circle cx="42" cy="16" r="6" fill="#F4D35E" stroke="#E0B93C" strokeWidth="1" />
          <path d="M42,11 L42,21 M37,16 L47,16" stroke="#E0B93C" strokeWidth="1" />
        </g>
      );
    case "orange":
      return (
        <g>
          <circle cx="42" cy="16" r="6" fill="#F2994A" stroke="#D97C2B" strokeWidth="1" />
          <path d="M42,11 L42,21 M38,13 L46,19 M38,19 L46,13" stroke="#D97C2B" strokeWidth="1" />
        </g>
      );
    case "grape":
      return (
        <g fill="#8E5DA8" stroke="#6E4482" strokeWidth="0.5">
          <circle cx="40" cy="12" r="3" />
          <circle cx="45" cy="13" r="3" />
          <circle cx="42.5" cy="17" r="3" />
        </g>
      );
    case "watermelon":
      return (
        <g>
          <path d="M35,10 A8,8 0 0 1 49,10 Z" fill="#5B9A5E" />
          <path d="M36.5,10 A6.5,6.5 0 0 1 47.5,10 Z" fill="#F4E9D8" />
          <path d="M38.5,10 A4.5,4.5 0 0 1 45.5,10 Z" fill="#E8536B" />
        </g>
      );
    case "mango":
      return <ellipse cx="42" cy="14" rx="6" ry="4.5" fill="#F4A93B" stroke="#D98A22" strokeWidth="1" transform="rotate(-20 42 14)" />;
    case "leaf":
      return <path d="M38,10 Q46,10 46,18 Q38,18 38,10 Z" fill="#7FA968" stroke="#5F8A4C" strokeWidth="1" />;
    case "ginger":
      return <path d="M37,10 Q41,8 45,11 Q43,15 39,15 Q36,13 37,10 Z" fill="#E8B84B" stroke="#C99A34" strokeWidth="1" />;
    case "almond":
      return (
        <g fill="#D8B27C" stroke="#B8925E" strokeWidth="0.5">
          <ellipse cx="27" cy="26" rx="4" ry="2.2" transform="rotate(-15 27 26)" />
          <ellipse cx="35" cy="24" rx="4" ry="2.2" transform="rotate(10 35 24)" />
        </g>
      );
    default:
      return null;
  }
}

interface GlassProps {
  liquid: string;
  garnish?: Garnish;
  tall?: boolean;
}

/** A simple tumbler/glass with a liquid fill — covers most drinks. */
function Glass({ liquid, garnish = "none", tall = false }: GlassProps): ReactElement {
  const topY = tall ? 14 : 18;
  return (
    <g>
      <path
        d={`M20,${topY} L44,${topY} L40,52 L24,52 Z`}
        fill="#FFFFFF"
        fillOpacity="0.35"
        stroke="#FFFFFF"
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />
      <path d={`M22,${topY + 12} L42,${topY + 12} L39.3,50 L24.7,50 Z`} fill={liquid} />
      <ellipse cx="32" cy={topY} rx="12" ry="2.4" fill="#FFFFFF" fillOpacity="0.55" />
      <GarnishMark kind={garnish} />
    </g>
  );
}

/** A rounded mug with a handle — coffee/malted drinks. */
function Mug({ liquid, steam = true }: { liquid: string; steam?: boolean }): ReactElement {
  return (
    <g>
      <path d="M19,20 h22 v20 a11,11 0 0 1 -22,0 Z" fill="#FFFFFF" fillOpacity="0.35" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1.5" />
      <path d="M41,26 h4 a5,5 0 0 1 0,10 h-4 Z" fill="none" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1.5" />
      <path d="M21,26 h18 v14 a9,9 0 0 1 -18,0 Z" fill={liquid} />
      <ellipse cx="30" cy="20" rx="11" ry="2.2" fill="#FFFFFF" fillOpacity="0.5" />
      {steam && (
        <g stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round" fill="none">
          <path d="M25,15 q-2,-3 0,-6" />
          <path d="M31,15 q2,-3 0,-6" />
        </g>
      )}
    </g>
  );
}

/** The cafe's namesake — a filter-coffee tumbler nested in its davara bowl. */
function FilterCoffeeSet(): ReactElement {
  return (
    <g>
      <path d="M14,44 Q32,52 50,44 L47,50 Q32,56 17,50 Z" fill="#D7DBE0" stroke="#AEB4BC" strokeWidth="1" />
      <path d="M24,16 L40,16 L37,44 L27,44 Z" fill="#E3E7EB" stroke="#AEB4BC" strokeWidth="1.2" />
      <path d="M26,20 L38,20 L36,30 L28,30 Z" fill="#6B4226" />
      <g stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" fill="none">
        <path d="M27,13 q-2,-3 0,-6" />
        <path d="M33,13 q2,-3 0,-6" />
      </g>
    </g>
  );
}

function Sandwich(): ReactElement {
  return (
    <g>
      <path d="M14,46 L32,16 L50,46 Z" fill="#E8C77E" stroke="#C99A4E" strokeWidth="1" />
      <path d="M19,38 L32,16 L45,38 Z" fill="#7FAE64" />
      <path d="M22,44 L32,26 L42,44 Z" fill="#D65B4A" />
      <path d="M14,46 L50,46" stroke="#C99A4E" strokeWidth="2" />
    </g>
  );
}

function BreadOmelette(): ReactElement {
  return (
    <g>
      <rect x="14" y="30" width="24" height="18" rx="4" fill="#E8C77E" stroke="#C99A4E" strokeWidth="1" />
      <ellipse cx="36" cy="26" rx="15" ry="11" fill="#F7F1E0" stroke="#E3D6B0" strokeWidth="1" />
      <ellipse cx="39" cy="25" rx="6" ry="5" fill="#F2B23B" />
      <g fill="#C99A4E">
        <circle cx="20" cy="38" r="0.8" />
        <circle cx="26" cy="42" r="0.8" />
        <circle cx="32" cy="37" r="0.8" />
      </g>
    </g>
  );
}

function Samosa(): ReactElement {
  return (
    <g>
      <path d="M16,48 L32,14 L48,48 Z" fill="#D99A45" stroke="#B87B2E" strokeWidth="1.2" />
      <path d="M20,44 L32,20 L44,44" fill="none" stroke="#B87B2E" strokeOpacity="0.6" strokeWidth="1" strokeDasharray="2 2" />
    </g>
  );
}

function Fritter({ shape = "round", bumpy = false }: { shape?: "round" | "ring" | "oval"; bumpy?: boolean }): ReactElement {
  if (shape === "ring") {
    return (
      <g>
        <circle cx="32" cy="32" r="17" fill="#C1802E" stroke="#9C6524" strokeWidth="1.2" />
        <circle cx="32" cy="32" r="6" fill="#F3E4C9" />
        {bumpy && (
          <g fill="#9C6524">
            <circle cx="22" cy="24" r="1" />
            <circle cx="42" cy="24" r="1" />
            <circle cx="22" cy="40" r="1" />
            <circle cx="42" cy="40" r="1" />
            <circle cx="32" cy="18" r="1" />
          </g>
        )}
      </g>
    );
  }
  if (shape === "oval") {
    return (
      <g>
        <ellipse cx="32" cy="32" rx="19" ry="12" fill="#CE8A44" stroke="#A96E33" strokeWidth="1.2" />
        <g fill="#A96E33">
          <circle cx="24" cy="29" r="0.9" />
          <circle cx="32" cy="35" r="0.9" />
          <circle cx="40" cy="28" r="0.9" />
          <circle cx="36" cy="33" r="0.9" />
        </g>
      </g>
    );
  }
  return (
    <g>
      <circle cx="26" cy="34" r="12" fill="#C97F3B" stroke="#A3652E" strokeWidth="1.1" />
      <circle cx="41" cy="30" r="10" fill="#C97F3B" stroke="#A3652E" strokeWidth="1.1" />
      {bumpy && (
        <g fill="#A3652E">
          <circle cx="22" cy="30" r="0.9" />
          <circle cx="30" cy="38" r="0.9" />
          <circle cx="44" cy="26" r="0.9" />
          <circle cx="38" cy="34" r="0.9" />
        </g>
      )}
    </g>
  );
}

function Murukku(): ReactElement {
  return (
    <g fill="none" stroke="#B97A2E" strokeWidth="3.4" strokeLinecap="round">
      <path d="M20,44 Q20,20 32,20 Q46,20 46,32 Q46,42 36,42 Q28,42 28,34 Q28,28 34,28" />
    </g>
  );
}

function BananaChips(): ReactElement {
  return (
    <g fill="#E9C96B" stroke="#C9A94A" strokeWidth="1">
      <ellipse cx="22" cy="38" rx="11" ry="6" transform="rotate(-18 22 38)" />
      <ellipse cx="34" cy="32" rx="11" ry="6" transform="rotate(-10 34 32)" />
      <ellipse cx="44" cy="40" rx="11" ry="6" transform="rotate(-25 44 40)" />
    </g>
  );
}

// --- registry ---------------------------------------------------------------

export interface ProductVisual {
  bg: string;
  render: () => ReactElement;
}

export const PRODUCT_VISUALS: Record<string, ProductVisual> = {
  "Filter Coffee": { bg: "#F0DFC8", render: () => <FilterCoffeeSet /> },
  "Masala Chai": { bg: "#F3E1C9", render: () => <Glass liquid="#8B5A2B" /> },
  "Plain Tea": { bg: "#F5E6D3", render: () => <Glass liquid="#A9713A" /> },
  "Ginger Tea": { bg: "#F6E8CE", render: () => <Glass liquid="#B97A3D" garnish="ginger" /> },
  "Black Coffee": { bg: "#EDE0D4", render: () => <Mug liquid="#3B2418" /> },
  "Green Tea": { bg: "#E3EEDD", render: () => <Glass liquid="#8FA876" garnish="leaf" /> },
  "Badam Milk": { bg: "#F5EDE0", render: () => <Glass liquid="#E8D9B8" garnish="almond" tall /> },
  Horlicks: { bg: "#EFE2CE", render: () => <Mug liquid="#9C6B3E" /> },

  "Lemon Juice": { bg: "#F7F2D0", render: () => <Glass liquid="#E9E17A" garnish="lemon" tall /> },
  "Rose Milk": { bg: "#FBE4EC", render: () => <Glass liquid="#F3A9C4" tall /> },
  Buttermilk: { bg: "#F6F1DC", render: () => <Glass liquid="#F1E9C2" tall /> },
  "Sweet Lassi": { bg: "#FBF3E4", render: () => <Glass liquid="#F5EBD3" tall /> },
  "Orange Juice": { bg: "#FDEBD8", render: () => <Glass liquid="#F2994A" garnish="orange" tall /> },
  "Grape Juice": { bg: "#EEE3F5", render: () => <Glass liquid="#8E5DA8" garnish="grape" tall /> },
  "Watermelon Juice": { bg: "#FCE2E4", render: () => <Glass liquid="#E8536B" garnish="watermelon" tall /> },
  "Mango Juice": { bg: "#FDECD0", render: () => <Glass liquid="#F4A93B" garnish="mango" tall /> },
  "Sugarcane Juice": { bg: "#F0F5DE", render: () => <Glass liquid="#D9E4A0" tall /> },

  "Veg Sandwich": { bg: "#F0EDD8", render: () => <Sandwich /> },
  "Bread Omelette": { bg: "#F5EDD8", render: () => <BreadOmelette /> },
  "Samosa (2 pcs)": { bg: "#F3E4C9", render: () => <Samosa /> },
  "Bonda (2 pcs)": { bg: "#F3E1C4", render: () => <Fritter shape="round" /> },
  "Mysore Bonda (2 pcs)": { bg: "#F0DEC0", render: () => <Fritter shape="round" bumpy /> },
  "Vegetable Cutlet (2 pcs)": { bg: "#F2E5CC", render: () => <Fritter shape="oval" /> },
  "Masala Vada (2 pcs)": { bg: "#F1E0C2", render: () => <Fritter shape="ring" bumpy /> },
  Murukku: { bg: "#F2E2C8", render: () => <Murukku /> },
  "Banana Chips": { bg: "#F5EEDA", render: () => <BananaChips /> },
};
