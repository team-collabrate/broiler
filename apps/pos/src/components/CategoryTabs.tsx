import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { categoryLabel, type Category } from '@broiler/shared';
import { t } from '../strings';
import { colors, spacing } from '../theme';
import { imageSource } from './ProductImage';

interface Props {
  /** Only the categories that have products. */
  categories: Category[];
  selected: string | null;
  onSelect: (key: string) => void;
}

/**
 * The category tabs above the catalog, as in the Kumbakonam POS: one tab per category, the
 * selected one underlined and filled. A category with a picture shows it as a round thumbnail.
 */
export function CategoryTabs({ categories, selected, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel={t.categoriesLabel} contentContainerStyle={styles.row} style={styles.scroll}>
      {categories.map((category) => {
        const active = category.key === selected;
        const picture = imageSource(category.image, category.key, 'category');
        return (
          <Pressable
            key={category.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(category.key)}
            style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.tabPressed]}
          >
            {picture && (
              <View style={styles.thumbWrap}>
                <Image source={picture} style={styles.thumb} resizeMode="cover" />
              </View>
            )}
            <Text style={[styles.text, active && styles.textActive]}>{categoryLabel(category.key, [category])}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
  // flexGrow on the content and on each tab makes the tabs share the row equally; with many tabs they scroll.
  row: { flexGrow: 1 },
  tab: {
    flexGrow: 1,
    minWidth: 140,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 4,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabPressed: { backgroundColor: colors.primarySoft },
  thumbWrap: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.primarySoft },
  thumb: { width: 44, height: 44 },
  text: { fontSize: 19, lineHeight: 28, fontWeight: '700', color: colors.muted },
  textActive: { color: colors.primary },
});
