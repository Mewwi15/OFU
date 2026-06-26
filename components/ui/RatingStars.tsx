import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';

export type RatingStarsProps = {
  /** Rating from 0..5. */
  rating: number;
  /** Star glyph size in px. Defaults to 14. */
  size?: number;
  /** Render the numeric value next to the stars. */
  showValue?: boolean;
  style?: StyleProp<ViewStyle>;
};

const MAX_STARS = 5;

/**
 * Five-star rating display. Renders filled / half / empty stars in gold.
 */
export function RatingStars({
  rating,
  size = 14,
  showValue,
  style,
}: RatingStarsProps) {
  const clamped = Math.max(0, Math.min(MAX_STARS, rating));

  return (
    <View style={[styles.row, style]}>
      {Array.from({ length: MAX_STARS }).map((_, i) => {
        const filled = clamped >= i + 1;
        const half = !filled && clamped > i;
        const name = filled ? 'star' : half ? 'star-half' : 'star-outline';
        return (
          <Ionicons
            key={i}
            name={name}
            size={size}
            color={Colors.star}
            style={styles.star}
          />
        );
      })}
      {showValue ? (
        <Text variant="caption" style={[styles.value, { color: Colors.textMuted }]}>
          {clamped.toFixed(1)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    marginRight: 2,
  },
  value: {
    marginLeft: Spacing.xs,
  },
});
