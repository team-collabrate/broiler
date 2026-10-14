import { Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { CATEGORY_IMAGES, ITEM_IMAGES } from '../images.generated';

/**
 * An item's or tab's picture: a key from the generated image map (scripts/build-image-map.mjs), or
 * an https link. Anything else, or a key with no picture added yet, gives null, and the card shows
 * plainly as a text card (the way the Kumbakonam POS shows an item that has no photo yet) rather
 * than a stand-in illustration.
 */
export function imageSource(image: string | null | undefined, fallbackKey?: string, kind: 'item' | 'category' = 'item'): ImageSourcePropType | null {
  const map = kind === 'item' ? ITEM_IMAGES : CATEGORY_IMAGES;
  if (image && /^https:\/\//.test(image)) return { uri: image };
  if (image && map[image]) return map[image];
  if (fallbackKey && map[fallbackKey]) return map[fallbackKey];
  return null;
}

/** Fills its parent, cropped to cover (the parent sets the shape, 4:3 for product cards). */
export function ProductImage({ source }: { source: ImageSourcePropType }) {
  return <Image source={source} style={styles.fill} resizeMode="cover" accessibilityIgnoresInvertColors />;
}

const styles = StyleSheet.create({ fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } });
