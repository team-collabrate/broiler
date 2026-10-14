import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LOGO } from '../images.generated';
import { t } from '../strings';
import { colors, spacing } from '../theme';

export const RAIL_WIDTH = 92;

interface Props {
  /** Today's rates are not all set yet: the Admin button shows a dot. */
  rateNeeded: boolean;
  onAdmin: () => void;
}

/**
 * The slim rail down the left edge, as in the Kumbakonam POS: the shop logo on top and the round
 * Admin button at the bottom, so neither takes room from the products or covers a card.
 */
export function SideRail({ rateNeeded, onAdmin }: Props) {
  return (
    <View style={styles.rail}>
      {LOGO ? <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel={t.appTitle} /> : null}
      <View style={styles.spacer} />
      <Pressable accessibilityRole="button" accessibilityLabel={t.admin} onPress={onAdmin} style={styles.admin}>
        <Text style={styles.adminText}>{t.adminShort}</Text>
        {rateNeeded && <View style={styles.dot} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { width: RAIL_WIDTH, alignItems: 'center', paddingVertical: spacing.lg, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border },
  logo: { width: 64, height: 78 },
  spacer: { flex: 1 },
  admin: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surface },
  adminText: { fontSize: 15, lineHeight: 24, fontWeight: '800', color: colors.primary },
  dot: { position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.warning, borderWidth: 2, borderColor: colors.surface },
});
