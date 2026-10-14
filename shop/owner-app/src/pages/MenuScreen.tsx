import { useMemo, useState } from "react";
import {
  ConfirmDialog,
  createMenuItem,
  deleteMenuItem,
  MENU_CATEGORIES,
  setMenuItemActive,
  swapMenuItemSortOrder,
  translateCategory,
  updateMenuItem,
  useLanguage,
  type MenuItem,
} from "@kumbakonam/shared";
import { useMenuItems } from "../hooks/useMenuItems";
import { MenuItemRow } from "../components/MenuItemRow";
import { MenuItemForm, type MenuItemFormValues } from "../components/MenuItemForm";
import "./MenuScreen.css";

type FormTarget = "new" | MenuItem | null;

const STRINGS = {
  title: { en: "Menu", ta: "மெனு" },
  addItem: { en: "+ Add Item", ta: "+ பொருள் சேர்" },
  loading: { en: "Loading…", ta: "ஏற்றுகிறது…" },
  empty: { en: "No menu items yet — add your first one.", ta: "இன்னும் மெனு பொருட்கள் இல்லை — முதலில் ஒன்றைச் சேர்க்கவும்." },
  saveFailed: { en: "Could not save this item. Please try again.", ta: "இந்தப் பொருளைச் சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்." },
  reorderFailed: {
    en: "Couldn't reorder that item. Please try again.",
    ta: "அதை மறுவரிசைப்படுத்த முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
  },
  deleteTitle: { en: "Delete item?", ta: "பொருளை நீக்கவா?" },
  deleteMessage: {
    en: "will be permanently removed from the menu. Past orders keep their own record, so this won't affect sales history.",
    ta: "மெனுவிலிருந்து நிரந்தரமாக நீக்கப்படும். முந்தைய ஆர்டர்கள் தங்கள் சொந்த பதிவைக் கொண்டிருப்பதால், இது விற்பனை வரலாற்றை பாதிக்காது.",
  },
  deleteConfirm: { en: "Delete", ta: "நீக்கு" },
  noCategory: { en: "Uncategorised", ta: "பிரிவு இல்லை" },
};

export function MenuScreen() {
  const { language } = useLanguage();
  const { items, loading, error: loadError } = useMenuItems();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);
  // Separate from `error` (the edit form's own save error) — a reorder can
  // fail while the form is closed, so it needs a banner of its own rather
  // than a state slot the form clears every time it opens or closes.
  const [reorderError, setReorderError] = useState<string | null>(null);

  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.category && set.add(i.category));
    return Array.from(set).sort();
  }, [items]);

  // Grouped the same way the Worker tabs are: the shop's own categories in
  // their day order first, then anything left over alphabetically. Move
  // up/down only ever compares an item against its neighbour within one of
  // these groups — items already arrive sorted by sortOrder (useMenuItems
  // -> subscribeToMenu), so array-adjacent here means sortOrder-adjacent.
  const groups = useMemo(() => {
    const byCategory = new Map<string, MenuItem[]>();
    for (const item of items) {
      const key = item.category || "";
      const list = byCategory.get(key);
      if (list) list.push(item);
      else byCategory.set(key, [item]);
    }
    const order = [
      ...MENU_CATEGORIES,
      ...Array.from(byCategory.keys())
        .filter((c) => c && !(MENU_CATEGORIES as readonly string[]).includes(c))
        .sort(),
      "",
    ];
    return order
      .filter((c) => byCategory.has(c))
      .map((category) => ({ category, items: byCategory.get(category)! }));
  }, [items]);

  const handleSave = async (values: MenuItemFormValues) => {
    setSaving(true);
    setError(null);
    try {
      if (formTarget === "new") {
        await createMenuItem({
          name: values.name,
          nameTa: values.nameTa,
          price: values.price,
          category: values.category,
        });
      } else if (formTarget) {
        await updateMenuItem(formTarget.itemId, values);
      }
      setFormTarget(null);
    } catch (err) {
      console.error("Menu item save failed", err);
      setError(STRINGS.saveFailed[language]);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = (item: MenuItem) => {
    setMenuItemActive(item.itemId, !item.active).catch((err) => console.error("Toggle active failed", err));
  };

  const moveItem = (categoryItems: MenuItem[], item: MenuItem, direction: -1 | 1) => {
    const index = categoryItems.findIndex((i) => i.itemId === item.itemId);
    const neighbor = categoryItems[index + direction];
    if (!neighbor || item.sortOrder === undefined || neighbor.sortOrder === undefined) return;
    setReorderError(null);
    swapMenuItemSortOrder(
      { itemId: item.itemId, sortOrder: item.sortOrder },
      { itemId: neighbor.itemId, sortOrder: neighbor.sortOrder },
    ).catch((err) => {
      console.error("Reorder failed", err);
      setReorderError(STRINGS.reorderFailed[language]);
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMenuItem(deleteTarget.itemId).catch((err) => console.error("Delete item failed", err));
    setDeleteTarget(null);
  };

  return (
    <div className="menu-screen">
      <div className="menu-screen__header">
        <h1 className="menu-screen__title">{STRINGS.title[language]}</h1>
        <button type="button" className="menu-screen__add" onClick={() => setFormTarget("new")}>
          {STRINGS.addItem[language]}
        </button>
      </div>

      {reorderError && <p className="menu-screen__error">{reorderError}</p>}

      {loadError ? (
        <p className="menu-screen__error">{loadError}</p>
      ) : loading ? (
        <p className="menu-screen__status">{STRINGS.loading[language]}</p>
      ) : items.length === 0 ? (
        <p className="menu-screen__status">{STRINGS.empty[language]}</p>
      ) : (
        groups.map(({ category, items: categoryItems }) => (
          <section key={category || "__none"} className="menu-screen__group">
            <h2 className="menu-screen__group-title">
              {category ? translateCategory(category, language) : STRINGS.noCategory[language]}
            </h2>
            <div className="menu-screen__list">
              {categoryItems.map((item, index) => (
                <MenuItemRow
                  key={item.itemId}
                  item={item}
                  onEdit={setFormTarget}
                  onToggleActive={handleToggleActive}
                  onDelete={setDeleteTarget}
                  onMoveUp={index > 0 ? () => moveItem(categoryItems, item, -1) : undefined}
                  onMoveDown={index < categoryItems.length - 1 ? () => moveItem(categoryItems, item, 1) : undefined}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {formTarget && (
        <MenuItemForm
          item={formTarget === "new" ? undefined : formTarget}
          existingCategories={existingCategories}
          saving={saving}
          error={error}
          onSave={handleSave}
          onClose={() => {
            setFormTarget(null);
            setError(null);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={STRINGS.deleteTitle[language]}
          message={`"${deleteTarget.name}" ${STRINGS.deleteMessage[language]}`}
          confirmLabel={STRINGS.deleteConfirm[language]}
          destructive
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
