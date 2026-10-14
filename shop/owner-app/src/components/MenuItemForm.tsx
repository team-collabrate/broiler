import { useState, type FormEvent } from "react";
import { MENU_CATEGORIES, useLanguage, type MenuItem } from "@kumbakonam/shared";
import "./MenuItemForm.css";

export interface MenuItemFormValues {
  name: string;
  nameTa: string;
  price: number;
  category: string;
  active: boolean;
}

export interface MenuItemFormProps {
  item?: MenuItem;
  existingCategories: string[];
  saving: boolean;
  error: string | null;
  onSave: (values: MenuItemFormValues) => void;
  onClose: () => void;
}

const STRINGS = {
  editItem: { en: "Edit Item", ta: "பொருளைத் திருத்து" },
  addItem: { en: "Add Item", ta: "பொருள் சேர்" },
  name: { en: "Name", ta: "பெயர் (ஆங்கிலம்)" },
  // No longer "(optional)" — the printed bill always shows this name,
  // never the English one, regardless of which language the app is
  // running in (see translateItemName / receipt.ts). A blank Tamil name
  // used to mean the receipt silently fell back to English; requiring it
  // here is what actually closes that gap, not just a stricter label.
  nameTa: { en: "Tamil Name", ta: "தமிழ் பெயர்" },
  price: { en: "Price (₹)", ta: "விலை (₹)" },
  category: { en: "Category", ta: "பிரிவு" },
  active: { en: "Active", ta: "செயலில்" },
  cancel: { en: "Cancel", ta: "ரத்துசெய்" },
  save: { en: "Save", ta: "சேமி" },
  saving: { en: "Saving…", ta: "சேமிக்கிறது…" },
};

/** Design Brief §7 — "Menu edit form (name, price, category toggle, active switch)". */
export function MenuItemForm({ item, existingCategories, saving, error, onSave, onClose }: MenuItemFormProps) {
  const { language } = useLanguage();
  const [name, setName] = useState(item?.name ?? "");
  const [nameTa, setNameTa] = useState(item?.nameTa ?? "");
  const [price, setPrice] = useState(item?.price?.toString() ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [active, setActive] = useState(item?.active ?? true);

  const isValid = name.trim().length > 0 && nameTa.trim().length > 0 && Number(price) > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSave({
      name: name.trim(),
      nameTa: nameTa.trim(),
      price: Number(price),
      category: category.trim(),
      active,
    });
  };

  return (
    <div
      className="menu-form__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={item ? STRINGS.editItem[language] : STRINGS.addItem[language]}
    >
      <form className="menu-form" onSubmit={handleSubmit}>
        <h2 className="menu-form__title">{item ? STRINGS.editItem[language] : STRINGS.addItem[language]}</h2>

        <label className="menu-form__field">
          <span>{STRINGS.name[language]}</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Filter Coffee" required />
        </label>

        <label className="menu-form__field">
          <span>{STRINGS.nameTa[language]}</span>
          <input
            type="text"
            value={nameTa}
            onChange={(e) => setNameTa(e.target.value)}
            placeholder="பில்டர் காபி"
            required
          />
        </label>

        <label className="menu-form__field">
          <span>{STRINGS.price[language]}</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="40"
            required
          />
        </label>

        <label className="menu-form__field">
          <span>{STRINGS.category[language]}</span>
          <input
            type="text"
            list="menu-form-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Breakfast"
          />
          {/* The four the shop sells by come first; anything already in use
              is offered after, so items on an older category set can still
              be matched exactly rather than retyped. */}
          <datalist id="menu-form-categories">
            {[...MENU_CATEGORIES, ...existingCategories.filter((c) => !MENU_CATEGORIES.includes(c as never))].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label className="menu-form__toggle-field">
          <span>{STRINGS.active[language]}</span>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        </label>

        {error && <p className="menu-form__error">{error}</p>}

        <div className="menu-form__actions">
          <button type="button" className="menu-form__cancel" onClick={onClose} disabled={saving}>
            {STRINGS.cancel[language]}
          </button>
          <button type="submit" className="menu-form__save" disabled={!isValid || saving}>
            {saving ? STRINGS.saving[language] : STRINGS.save[language]}
          </button>
        </div>
      </form>
    </div>
  );
}
