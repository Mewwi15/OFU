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
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleMaps, GoogleMaps } from '@/components/maps/native-maps';
import { DeliveryStepper } from '@/components/order/DeliveryStepper';
import { RiderIllustration } from '@/components/shop/RiderIllustration';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { DELIVERY_STAGES, stageIndexFor, type LatLng, type TrackedOrder } from '@/data/fulfillment';
import { subscribeRiderLocation, type RiderFix } from '@/lib/data/riderLocation';
import { useT } from '@/lib/i18n';

/** Fallback view when the order carries no pin and the rider hasn't reported —
 *  centred on Bangkok so the map is never a grey void. */
const FALLBACK_CENTER: LatLng = { latitude: 13.7563, longitude: 100.5018 };

/** Frame the customer and the rider together, biased north so the pair sits in
 *  the map strip above the (tall) status sheet instead of behind it. */
function cameraFor(dest: LatLng | undefined, rider: LatLng | null) {
  const pts = [dest, rider].filter(Boolean) as LatLng[];
  if (pts.length === 0) return { coordinates: FALLBACK_CENTER, zoom: 12 };
  const lat = pts.reduce((a, p) => a + p.latitude, 0) / pts.length;
  const lng = pts.reduce((a, p) => a + p.longitude, 0) / pts.length;
  // Zoom out as the gap grows so both markers stay on screen.
  const spread = pts.length < 2 ? 0 : Math.max(
    Math.abs(pts[0].latitude - pts[1].latitude),
    Math.abs(pts[0].longitude - pts[1].longitude),
  );
  const zoom = spread > 0.08 ? 11.5 : spread > 0.03 ? 12.8 : spread > 0.01 ? 13.8 : 14.6;
  return { coordinates: { latitude: lat - 0.0034, longitude: lng }, zoom };
}

/** Straight-line metres between two fixes. Good enough for "how far away is my
 *  order" — a routed distance would need a paid Directions call to say something
 *  the customer reads as a rough sense of closeness anyway. */
function metresBetween(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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

  // Live rider position, straight off the private Realtime channel the shop
  // broadcasts to while the order is out for delivery. No fix yet is the normal
  // opening state (and also what a rider who hasn't started sharing looks like)
  // — the sheet says "on the way" and the map simply shows no rider marker,
  // rather than inventing a position.
  const [fix, setFix] = useState<RiderFix | null>(null);
  useEffect(() => {
    if (!order.orderId || order.status !== 'out_for_delivery') return;
    setFix(null);
    return subscribeRiderLocation(order.orderId, setFix);
  }, [order.orderId, order.status]);

  const riderPos = useMemo<LatLng | null>(
    () => (fix ? { latitude: fix.lat, longitude: fix.lng } : null),
    [fix],
  );
  const dest = order.destination;
  const camera = useMemo(() => cameraFor(dest, riderPos), [dest, riderPos]);
  const arrived = order.status === 'delivered';
  const riderIcon = useImage(require('@/assets/images/rider-marker.png'));

  const subtitle = useMemo(() => {
    if (arrived) return t('track.comePickUp');
    if (!riderPos || !dest) return t('track.waitingSignal');
    const m = metresBetween(riderPos, dest);
    return m < 1000
      ? t('track.distanceAwayM').replace('{d}', String(Math.max(10, Math.round(m / 10) * 10)))
      : t('track.distanceAway').replace('{d}', (m / 1000).toFixed(1));
  }, [arrived, riderPos, dest, t]);

  return (
    <View style={styles.screen}>
      {/* Native map */}
      {Platform.OS === 'ios' ? (
        <AppleMaps.View
          style={StyleSheet.absoluteFill}
          cameraPosition={camera}
          markers={dest ? [{ coordinates: dest, title: t('track.destination') }] : []}
          annotations={
            riderPos
              ? riderIcon
                ? [{ coordinates: riderPos, icon: riderIcon, title: order.rider.name }]
                : [{ coordinates: riderPos, text: order.rider.name }]
              : []
          }
        />
      ) : (
        <GoogleMaps.View
          style={StyleSheet.absoluteFill}
          cameraPosition={camera}
          markers={[
            ...(riderPos
              ? [
                  riderIcon
                    ? { coordinates: riderPos, icon: riderIcon, title: order.rider.name }
                    : { coordinates: riderPos, title: order.rider.name },
                ]
              : []),
            ...(dest ? [{ coordinates: dest, title: t('track.destination') }] : []),
          ]}
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
            <Text style={styles.arriving}>{subtitle}</Text>
          </View>
          <RiderIllustration size={104} />
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
