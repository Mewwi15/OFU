/**
 * TrackingMapView — order-tracking state 2 ("กำลังจัดส่ง").
 *
 * A live route map (native expo-maps) with the rider + destination markers and
 * the delivery polyline, under a status sheet: a 4-step delivery stepper, the
 * rider row (chat / call), and a "ได้รับสินค้าแล้ว" confirm CTA. Tokens-only,
 * zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image, useImage } from 'expo-image';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleMaps, GoogleMaps } from '@/components/maps/native-maps';
import { DeliveryStepper } from '@/components/order/DeliveryStepper';
import { RiderIllustration } from '@/components/shop/RiderIllustration';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import {
  DELIVERY_DESTINATION,
  DELIVERY_ROUTE,
  DELIVERY_STAGES,
  stageIndexFor,
  type TrackedOrder,
} from '@/data/fulfillment';
import { useT } from '@/lib/i18n';
import { useRiderRoute } from '@/lib/useRiderRoute';

// Fixed camera, biased south of the route midpoint so the path sits in the map
// strip above the (tall) status sheet instead of behind it.
const CAMERA = {
  coordinates: {
    latitude: (DELIVERY_ROUTE[0].latitude + DELIVERY_DESTINATION.latitude) / 2 - 0.0034,
    longitude: (DELIVERY_ROUTE[0].longitude + DELIVERY_DESTINATION.longitude) / 2,
  },
  zoom: 14.4,
};

type Props = {
  order: TrackedOrder;
  onClose: () => void;
  onHelp: () => void;
  onChat: () => void;
  onCall: () => void;
  onArrived: () => void;
};

export function TrackingMapView({ order, onClose, onHelp, onChat, onCall, onArrived }: Props) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const activeIndex = stageIndexFor(order.status);

  // Live rider movement along the route + branded marker artwork.
  const { position, progress, minutesLeft, arrived } = useRiderRoute();
  const riderIcon = useImage(require('@/assets/images/rider-marker.png'));

  return (
    <View style={styles.screen}>
      {/* Native map */}
      {Platform.OS === 'ios' ? (
        <AppleMaps.View
          style={StyleSheet.absoluteFill}
          cameraPosition={CAMERA}
          markers={[{ coordinates: DELIVERY_DESTINATION, title: t('track.destination') }]}
          annotations={
            riderIcon
              ? [{ coordinates: position, icon: riderIcon, title: order.rider.name }]
              : [{ coordinates: position, text: order.rider.name }]
          }
          polylines={[{ coordinates: DELIVERY_ROUTE, color: Colors.primary, width: 5 }]}
        />
      ) : (
        <GoogleMaps.View
          style={StyleSheet.absoluteFill}
          cameraPosition={CAMERA}
          markers={[
            riderIcon
              ? { coordinates: position, icon: riderIcon, title: order.rider.name }
              : { coordinates: position, title: order.rider.name },
            { coordinates: DELIVERY_DESTINATION, title: t('track.destination') },
          ]}
          polylines={[{ coordinates: DELIVERY_ROUTE, color: Colors.primary, width: 5 }]}
        />
      )}

      {/* Top controls */}
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[styles.topRow, { top: insets.top + Spacing.sm }]}
        pointerEvents="box-none">
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('track.close')}
          onPress={onClose}
          style={styles.roundBtn}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('track.help')}
          onPress={onHelp}
          style={styles.helpBtn}>
          <Text style={styles.helpText}>{t('track.help')}</Text>
        </PressableScale>
      </Animated.View>

      {/* Status sheet */}
      <Animated.View
        entering={SlideInDown.springify().damping(20).stiffness(180)}
        style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text variant="title" style={styles.sheetTitle}>
              {arrived ? t('track.riderArrived') : t('track.riderOnTheWay')}
            </Text>
            <Text style={styles.arriving}>
              {arrived
                ? t('track.comePickUp')
                : `${t('track.arrivingPrefix')}~${minutesLeft} ${t('track.minutesUnit')}`}
            </Text>
          </View>
          <RiderIllustration size={104} />
        </View>

        {/* Live progress toward the customer */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>

        {/* Stepper */}
        <DeliveryStepper stages={DELIVERY_STAGES} activeIndex={activeIndex} />

        <Text variant="caption" style={styles.stepHint}>
          {t('track.giveRiderTimePrefix')}
          {order.rider.name.split(' ')[0]}
          {t('track.giveRiderTimeSuffix')}
        </Text>

        {/* Rider row */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.riderRow}>
          <Image source={{ uri: order.rider.avatar }} style={styles.riderAvatar} contentFit="cover" />
          <View style={styles.riderInfo}>
            <Text variant="caption">{t('track.oofooRider')}</Text>
            <View style={styles.riderNameRow}>
              <Text style={styles.riderName} numberOfLines={1}>
                {order.rider.name}
              </Text>
              <Ionicons name="shield-checkmark" size={14} color={Colors.primaryStrong} />
            </View>
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('track.chatRiderA11y')}
            onPress={onChat}
            style={styles.riderAction}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.primaryStrong} />
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('track.callRiderA11y')}
            onPress={onCall}
            style={styles.riderAction}>
            <Ionicons name="call-outline" size={20} color={Colors.primaryStrong} />
          </PressableScale>
        </Animated.View>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('track.confirmReceivedA11y')}
          onPress={onArrived}
          style={styles.cta}>
          <Text style={styles.ctaText}>{t('track.receivedGoods')}</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.surfaceMuted,
  },
  topRow: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  helpBtn: {
    paddingHorizontal: Spacing.lg,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  helpText: {
    ...Typography.button,
    color: Colors.text,
  },

  /* Sheet */
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    backgroundColor: Colors.surface,
    ...Shadow.float,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  sheetTitle: {
    marginBottom: 2,
  },
  arriving: {
    ...Typography.bodyStrong,
    color: Colors.primaryStrong,
  },
  progressTrack: {
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
    overflow: 'hidden',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },

  stepHint: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },

  /* Rider */
  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
  },
  riderInfo: {
    flex: 1,
    gap: 1,
  },
  riderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  riderName: {
    ...Typography.bodyStrong,
    color: Colors.text,
    flexShrink: 1,
  },
  riderAction: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginTop: Spacing.lg,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  ctaText: {
    ...Typography.button,
    fontSize: 16,
    color: Colors.textOnPrimary,
  },
});
