/**
 * ParcelTrackingView — order-tracking screen for an ONLINE (Flash Express)
 * shipment. Unlike the rider flow there's no live map; instead it shows the
 * courier + tracking number (copyable, opens Flash tracking), a vertical
 * status timeline, the destination address and an order summary. Drives the
 * same three order statuses (preparing → out_for_delivery → delivered) mapped
 * onto the parcel stages. Tokens-only, zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Breathing } from '@/components/ui/Breathing';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import {
  EXCEPTION_META,
  isExceptionStatus,
  PARCEL_STAGES,
  parcelStageIndexFor,
  type TrackedOrder,
} from '@/data/fulfillment';
import { money } from '@/lib/format';

/** Owner-illustrated 3D clay art per parcel stage (transparent PNGs). */
const PARCEL_ART: Record<string, ReturnType<typeof require>> = {
  preparing: require('@/assets/images/parcel/parcel-1.png'),
  picked_up: require('@/assets/images/parcel/parcel-2.png'),
  in_transit: require('@/assets/images/parcel/parcel-3.png'),
  out_for_delivery: require('@/assets/images/parcel/parcel-4.png'),
  delivered: require('@/assets/images/parcel/parcel-5.png'),
};

type Props = {
  order: TrackedOrder;
  /** Close (X) — return home, keep the order tracking. */
  onClose: () => void;
  /** Customer confirms the parcel arrived → mark delivered. */
  onArrived: () => void;
  /** Finish a delivered order → archive + home. */
  onDone: () => void;
  onHelp: () => void;
};

export function ParcelTrackingView({ order, onClose, onArrived, onDone, onHelp }: Props) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  const activeIndex = parcelStageIndexFor(order.status);
  const delivered = order.status === 'delivered';
  const exception = isExceptionStatus(order.status);
  const exceptionMeta = isExceptionStatus(order.status)
    ? EXCEPTION_META[order.status]
    : undefined;
  const activeStage = PARCEL_STAGES[activeIndex];
  const heroLabel = exceptionMeta?.label ?? activeStage?.label ?? 'กำลังดำเนินการ';
  const heroArt = activeStage ? PARCEL_ART[activeStage.key] : undefined;
  const trackingNo = order.trackingNo ?? '-';

  const copyTracking = async () => {
    if (!order.trackingNo) return;
    await Clipboard.setStringAsync(order.trackingNo);
    if (Platform.OS !== 'web') {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  const openFlash = () => {
    if (!order.trackingNo) return;
    Linking.openURL(
      `https://www.flashexpress.com/fle/tracking?se=${encodeURIComponent(order.trackingNo)}`,
    ).catch(() => {});
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <IconButton icon="close" accessibilityLabel="ปิด" onPress={onClose} />
        <Text variant="subtitle">ติดตามพัสดุ</Text>
        <IconButton icon="help-circle-outline" accessibilityLabel="ช่วยเหลือ" onPress={onHelp} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}>
        {/* Hero status */}
        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.hero}>
          {exception ? (
            <View style={[styles.heroBadge, styles.heroBadgeWarn]}>
              <Ionicons
                name={exceptionMeta?.icon ?? 'alert-circle'}
                size={56}
                color={Colors.dangerStrong}
              />
            </View>
          ) : (
            <Breathing amount={delivered ? 0 : 0.05} duration={1600} style={styles.heroBadge}>
              {heroArt ? (
                <Image
                  source={heroArt}
                  style={styles.heroArt}
                  contentFit="contain"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <Ionicons name="cube" size={48} color={Colors.primaryStrong} />
              )}
            </Breathing>
          )}
          <Text variant="title" style={[styles.heroTitle, exception && styles.heroTitleWarn]}>
            {heroLabel}
          </Text>
          <Text variant="body" style={styles.heroSub}>
            {exceptionMeta
              ? exceptionMeta.message
              : delivered
                ? 'ขอบคุณที่ใช้บริการอู้ฟู่'
                : `พัสดุของคุณ · ${order.etaText}`}
          </Text>
        </Animated.View>

        {/* Tracking number card */}
        <Animated.View entering={FadeInDown.delay(60).springify().damping(18)} style={styles.trackCard}>
          <View style={styles.courierRow}>
            <View style={styles.courierTile}>
              <Ionicons name="cube" size={18} color={Colors.textOnPrimary} />
            </View>
            <View style={styles.flexOne}>
              <Text variant="caption" style={styles.muted}>
                ขนส่งโดย
              </Text>
              <Text style={styles.courierName}>{order.courier ?? 'Flash Express'}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="ติดตามบนเว็บ Flash"
              hitSlop={8}
              onPress={openFlash}
              style={styles.flashLink}>
              <Text style={styles.flashLinkText}>ติดตามบน Flash</Text>
              <Ionicons name="open-outline" size={14} color={Colors.primaryStrong} />
            </Pressable>
          </View>

          <View style={styles.trackNoRow}>
            <View style={styles.flexOne}>
              <Text variant="caption" style={styles.muted}>
                เลขพัสดุ
              </Text>
              <Text style={styles.trackNo}>{trackingNo}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="คัดลอกเลขพัสดุ"
              hitSlop={8}
              onPress={copyTracking}
              style={styles.copyBtn}>
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={15}
                color={Colors.primaryStrong}
              />
              <Text style={styles.copyText}>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Status timeline */}
        <Animated.View entering={FadeInDown.delay(120).springify().damping(18)} style={styles.timelineCard}>
          {PARCEL_STAGES.map((stage, i) => {
            const done = i < activeIndex;
            const isCurrent = i === activeIndex;
            const failedHere = exception && isCurrent;
            const active = isCurrent && !exception;
            const reached = done || isCurrent;
            const last = i === PARCEL_STAGES.length - 1;
            return (
              <View key={stage.key} style={styles.stageRow}>
                <View style={styles.stageRail}>
                  <View
                    style={[
                      styles.stageDot,
                      active && styles.stageDotActive,
                      failedHere && styles.stageDotFailed,
                    ]}>
                    {failedHere ? (
                      <Ionicons
                        name={exceptionMeta?.icon ?? 'alert-circle'}
                        size={26}
                        color={Colors.textOnPrimary}
                      />
                    ) : (
                      <Image
                        source={PARCEL_ART[stage.key]}
                        style={[styles.stageArt, !reached && styles.stageArtDim]}
                        contentFit="contain"
                        accessibilityIgnoresInvertColors
                      />
                    )}
                  </View>
                  {!last ? (
                    <View
                      style={[
                        styles.stageLine,
                        done ? styles.stageLineOn : styles.stageLineOff,
                      ]}
                    />
                  ) : null}
                </View>
                <View style={styles.stageBody}>
                  <Text
                    style={[
                      styles.stageLabel,
                      reached ? styles.stageLabelOn : styles.stageLabelOff,
                      failedHere && styles.stageLabelFailed,
                    ]}>
                    {failedHere ? (exceptionMeta?.label ?? stage.label) : stage.label}
                  </Text>
                  {failedHere ? (
                    <Text variant="caption" style={styles.stageFailed}>
                      หยุดที่ขั้นตอนนี้
                    </Text>
                  ) : active ? (
                    <Text variant="caption" style={styles.stageNow}>
                      สถานะปัจจุบัน
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </Animated.View>

        {/* Destination */}
        <Animated.View entering={FadeInDown.delay(180).springify().damping(18)} style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={Colors.primaryStrong} />
            <View style={styles.flexOne}>
              <Text variant="caption" style={styles.muted}>
                จัดส่งถึง · {order.addressLabel}
              </Text>
              <Text variant="body" style={styles.infoValue}>
                {order.addressLine}
              </Text>
            </View>
          </View>
          <View style={styles.infoHairline} />
          <View style={styles.infoRow}>
            <Ionicons name="receipt-outline" size={18} color={Colors.primaryStrong} />
            <View style={styles.flexOne}>
              <Text variant="caption" style={styles.muted}>
                {order.id} · {order.itemCount} ชิ้น
              </Text>
              <Text variant="body" style={styles.infoValue}>
                ยอดชำระ {money(order.total)}
                {order.placedAtLabel ? ` · สั่งเมื่อ ${order.placedAtLabel}` : ''}
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Footer action */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        {exception ? (
          <View style={styles.footerStack}>
            <Button onPress={onHelp}>ติดต่อร้านอู้ฟู่</Button>
            <Button variant="secondary" onPress={openFlash}>
              ติดตามบน Flash
            </Button>
          </View>
        ) : delivered ? (
          <Button onPress={onDone}>เสร็จสิ้น</Button>
        ) : order.status === 'out_for_delivery' ? (
          <Button onPress={onArrived}>ฉันได้รับพัสดุแล้ว</Button>
        ) : (
          <Button variant="secondary" onPress={openFlash}>
            ติดตามสถานะบน Flash
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.lg,
  },
  flexOne: {
    flex: 1,
  },
  muted: {
    color: Colors.textMuted,
  },

  /* Hero */
  hero: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  heroBadge: {
    width: 136,
    height: 136,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  heroArt: {
    width: 116,
    height: 116,
  },
  heroBadgeWarn: {
    backgroundColor: Colors.surfaceMuted,
  },
  heroTitle: {
    textAlign: 'center',
  },
  heroTitleWarn: {
    color: Colors.dangerStrong,
  },
  heroSub: {
    color: Colors.textMuted,
    textAlign: 'center',
  },

  /* Tracking card */
  trackCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.card,
  },
  courierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  courierTile: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courierName: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  flashLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  flashLinkText: {
    ...Typography.label,
    color: Colors.primaryStrong,
  },
  trackNoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  trackNo: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 18,
    letterSpacing: 1,
    color: Colors.text,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
  },
  copyText: {
    ...Typography.label,
    color: Colors.primaryStrong,
  },

  /* Timeline */
  timelineCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadow.card,
  },
  stageRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  stageRail: {
    alignItems: 'center',
    width: 54,
  },
  stageDot: {
    width: 54,
    height: 54,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stageArt: {
    width: 46,
    height: 46,
  },
  stageArtDim: {
    opacity: 0.34,
  },
  stageDotActive: {
    backgroundColor: Colors.primaryTint,
    borderColor: Colors.primary,
  },
  stageDotFailed: {
    backgroundColor: Colors.dangerStrong,
    borderColor: Colors.dangerStrong,
  },
  stageLine: {
    width: 2,
    flex: 1,
    minHeight: 18,
    marginVertical: 3,
  },
  stageLineOn: {
    backgroundColor: Colors.primary,
  },
  stageLineOff: {
    backgroundColor: Colors.border,
  },
  stageBody: {
    flex: 1,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  stageLabel: {
    ...Typography.body,
  },
  stageLabelOn: {
    color: Colors.text,
    fontFamily: 'Mitr_500Medium',
  },
  stageLabelOff: {
    color: Colors.textMuted,
  },
  stageNow: {
    color: Colors.primaryStrong,
    marginTop: 1,
  },
  stageLabelFailed: {
    color: Colors.dangerStrong,
    fontFamily: 'Mitr_500Medium',
  },
  stageFailed: {
    color: Colors.dangerStrong,
    marginTop: 1,
  },

  /* Info card */
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.card,
  },
  infoRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  infoValue: {
    color: Colors.text,
    marginTop: 1,
  },
  infoHairline: {
    height: 1,
    backgroundColor: Colors.border,
  },

  /* Footer */
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerStack: {
    gap: Spacing.sm,
  },
});
