import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { BillData } from '../bill';
import { colors, spacing } from '../theme';
import { Bill } from './Bill';

interface Props {
  bill: BillData;
  /** Close the bill and start the next customer. */
  onDone: () => void;
}

/** The saved bill in a popup, with Print and New bill. Payment is chosen in the cart, before Print bill. */
export function BillModal({ bill, onDone }: Props) {
  const { height } = useWindowDimensions();
  return (
    <Modal transparent animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { height: Math.max(height - 24, 420) }]} accessibilityViewIsModal>
          <Bill bill={bill} onNew={onDone} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(8, 24, 14, 0.55)' },
  sheet: { width: '100%', maxWidth: 440, borderRadius: 22, backgroundColor: colors.surface, overflow: 'hidden' },
});
