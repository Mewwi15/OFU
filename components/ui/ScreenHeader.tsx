import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/Text';
import { Spacing } from '@/constants/theme';

export type ScreenHeaderProps = {
  /** Centered screen title. Ignored when `brand` is true. */
  title?: string;
  /** Optional left-side node (e.g. a back IconButton). */
  left?: React.ReactNode;
  /** Optional right-side node(s) (e.g. bell + bag IconButtons). */
  right?: React.ReactNode;
  /**
   * When true, render the อู้ฟู่ brand logo image on the left instead of a
   * centered title.
   */
  brand?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Standard screen header: optional left node, centered title (or left-aligned
 * brand wordmark), and optional right node(s).
 */
export function ScreenHeader({
  title,
  left,
  right,
  brand,
  style,
}: ScreenHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={[styles.side, styles.sideLeft]}>
        {brand ? (
          <Image
            source={require('@/assets/images/logo-oofoo.png')}
            style={{ height: 32, width: 73 }}
            contentFit="contain"
          />
        ) : (
          left
        )}
      </View>

      {!brand && title ? (
        <View style={styles.center} pointerEvents="none">
          <AppText variant="h1" numberOfLines={1}>
            {title}
          </AppText>
        </View>
      ) : null}

      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  // The centered title is absolutely positioned so an asymmetric left/right
  // node count never shifts it off-center.
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  side: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  sideLeft: {
    justifyContent: 'flex-start',
  },
  sideRight: {
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
});
