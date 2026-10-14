import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../strings';
import { colors, spacing } from '../theme';

interface Props {
  /** Today's rates are not all set yet: the entry says so. */
  rateNeeded: boolean;
  onRates: () => void;
  onKhata: () => void;
  onLock: () => void;
  onClose: () => void;
}

/** What the round Admin button opens: the owner's jobs at the counter, kept off the selling screen. */
export function AdminMenu({ rateNeeded, onRates, onKhata, onLock, onClose }: Props) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.dismiss}>
        {/* The card swallows taps so only the backdrop closes the menu. */}
        <Pressable style={styles.card} onPress={() => undefined} accessibilityViewIsModal>
          <Text style={styles.title}>{t.admin}</Text>
          <Pressable accessibilityRole="button" onPress={onRates} style={styles.item}>
            <Text style={styles.itemText}>{t.todaysRate}</Text>
            {rateNeeded && <View style={styles.dot} />}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onKhata} style={styles.item}>
            <Text style={styles.itemText}>{t.khataMenu}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onLock} style={styles.item}>
            <Text style={styles.itemText}>{t.lockLabel}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={[styles.item, styles.close]}>
            <Text style={styles.closeText}>{t.cancel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-start', padding: spacing.lg, backgroundColor: 'rgba(8, 24, 14, 0.45)' },
  card: { width: 300, gap: spacing.sm, padding: spacing.lg, borderRadius: 20, backgroundColor: colors.surface },
  title: { fontSize: 18, lineHeight: 28, fontWeight: '800', color: colors.primary },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 56, paddingHorizontal: spacing.lg, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  itemText: { fontSize: 17, lineHeight: 26, fontWeight: '700', color: colors.text },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.warning },
  close: { backgroundColor: colors.surface },
  closeText: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.muted },
});
