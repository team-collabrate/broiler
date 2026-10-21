import type { MenuItem } from "@kumbakonam/shared/core";

/**
 * Where a product's picture is served from. A product's `image` can be a full https link; otherwise the picture
 * is the file `public/items/<key>.jpg` where the key is the product's `image` field or, failing that, its id.
 * Photos are prepared with `npm run images` (cropped to 4:3 and shrunk). A missing file simply shows the card
 * without a photo: the component hides a picture that fails to load.
 */
export function productImageUrl(item: Pick<MenuItem, "id" | "image">): string {
  if (item.image && /^https:\/\//.test(item.image)) return item.image;
  return `/items/${encodeURIComponent(item.image ?? item.id)}.jpg`;
}

/** The picture for a category tab (optional): `public/categories/<key>.jpg`. */
export function categoryImageUrl(key: string): string {
  return `/categories/${encodeURIComponent(key)}.jpg`;
}
