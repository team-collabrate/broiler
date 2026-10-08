import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatMoney, type MenuItem } from '@broiler/shared';
import { colors, spacing } from '../theme';

interface Props {
  items: MenuItem[];
  columns: number;
  onSelect: (item: MenuItem) => void;
}

export function MenuGrid({ items, columns, onSelect }: Props) {
  return (
    <FlatList
      // numColumns can't change on a mounted list, so a new key remounts it when the layout flips.
      key={columns}
      data={items}
      numColumns={columns}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      columnWrapperStyle={columns > 1 ? styles.row : undefined}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${formatMoney(item.pricePerKgMinor)} per kilo`}
          onPress={() => onSelect(item)}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          <View>
            <Text style={styles.price}>{formatMoney(item.pricePerKgMinor)}</Text>
            <Text style={styles.unit}>per kg</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  row: { gap: spacing.md },
  card: {
    flex: 1,
    minHeight: 112,
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  name: { fontSize: 17, fontWeight: '600', color: colors.text },
  price: { fontSize: 20, fontWeight: '700', color: colors.primary },
  unit: { fontSize: 13, color: colors.muted },
});
