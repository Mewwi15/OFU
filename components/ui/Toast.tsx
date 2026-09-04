/**
 * Toast — our own success card (replaces the native Alert for in-app feedback
 * like "added to cart"). A centered, rounded card that zooms in over a soft
 * backdrop: a green check, a message, an optional subtitle and a primary
 * action. Auto-dismisses, and tapping the backdrop dismisses early. Mount it
 * conditionally and flip the parent state off in `onHide`.
 *
 *   {showToast && (
 *     <Toast message="เพิ่มลงตะกร้าแล้ว" actionLabel="ดูตะกร้า"
 *            onAction={...} onHide={() => setShowToast(false)} />
 *   )}
 *
 * ★ ครอบด้วย Modal ★ ไม่ใช่ View ที่กาง absoluteFill เฉย ๆ — absoluteFill กางเต็ม
 * "กล่องแม่ที่ใกล้ที่สุด" ไม่ใช่เต็มจอ ตอนเอาไปวางในบล็อกคูปองของหน้าแรก (ซึ่งอยู่ใน
 * ScrollView อีกที) การ์ดเลยโดนตัดครึ่ง ปุ่มขาดหาย และฉากหลังมืดแค่เฉพาะช่วงบล็อกนั้น
 * (เจ้าของทัก 4 ก.ย. 2026 "มัน modal ไม่ดีอะครับลองกดดูสิ")
 * Modal วาดที่ชั้นบนสุดของหน้าจอเสมอ ไม่ว่าถูกเรียกจากตรงไหนของต้นไม้คอมโพเนนต์
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { BRAND_ACCENT, type Accent } from '@/constants/accent';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ToastProps = {
  message: string;
  /** Optional second line under the message. */
  subtitle?: string;
  /** Ionicons glyph for the success circle. Defaults to a check. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Optional primary action (e.g. "ดูตะกร้า"). */
  actionLabel?: string;
  onAction?: () => void;
  /** Called when dismissed (auto-timer or backdrop tap) — flip parent state off. */
  onHide: () => void;
  /** Visible duration in ms before auto-dismiss. Defaults to 2800 — or 4500
   *  when there's an action button, so the user has time to decide to tap it. */
  duration?: number;
  /** สีเน้นของหน้าที่เรียกใช้ — ไม่ส่ง = สีแบรนด์ (ส้ม) */
  accent?: Accent;
};

export function Toast({
  message,
  subtitle,
  icon = 'checkmark',
  actionLabel,
  onAction,
  onHide,
  duration,
  accent = BRAND_ACCENT,
}: ToastProps) {
  const t = useT();
  const visibleMs = duration ?? (actionLabel ? 4500 : 2800);
  useEffect(() => {
    const timer = setTimeout(onHide, visibleMs);
    return () => clearTimeout(timer);
  }, [onHide, visibleMs]);

  return (
    <Modal
      transparent
      visible
      /* แอนิเมชันเข้า/ออกทำเองด้วย reanimated ข้างใน ไม่ให้ Modal เล่นซ้อน */
      animationType="none"
      /* แอนดรอยด์: ให้ฉากหลังมืดคลุมถึงแถบสถานะด้วย ไม่งั้นจะเหลือแถบสว่างค้างข้างบน */
      statusBarTranslucent
      /* ปุ่มย้อนกลับของแอนดรอยด์ต้องปิดได้ ไม่ใช่เด้งออกจากหน้า */
      onRequestClose={onHide}>
      <View pointerEvents="box-none" style={styles.wrap}>
        <AnimatedPressable
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(200)}
          accessibilityLabel={t('ui.close')}
          onPress={onHide}
          style={styles.backdrop}
        />

        <Animated.View
          entering={ZoomIn.springify().damping(15).stiffness(200)}
          exiting={FadeOut.duration(180)}
          style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('ui.close')}
            hitSlop={10}
            onPress={onHide}
            style={styles.close}>
            <Ionicons name="close" size={20} color={Colors.textMuted} />
          </Pressable>

          <View style={[styles.iconCircle, { backgroundColor: accent.solid }]}>
            <Ionicons name={icon} size={32} color={Colors.textOnPrimary} />
          </View>

          <Text style={styles.title}>{message}</Text>
          {subtitle ? (
            <Text variant="caption" style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}

          {actionLabel ? (
            <PressableScale
              accessibilityRole="button"
              onPress={onAction}
              scaleTo={0.97}
              style={[styles.actionBtn, { backgroundColor: accent.strong }]}>
              <Text style={styles.actionText}>{actionLabel}</Text>
            </PressableScale>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.x2,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.scrim,
  },
  card: {
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    paddingHorizontal: Spacing.x2,
    paddingTop: Spacing.x2,
    paddingBottom: Spacing.xl,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    ...Shadow.float,
  },
  close: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    // สีจริงมาจาก accent ที่จุดเรียกใช้
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 17,
    lineHeight: 24,
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: Spacing.xxs,
    textAlign: 'center',
  },
  actionBtn: {
    alignSelf: 'stretch',
    height: 48,
    marginTop: Spacing.xl,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 15,
    color: Colors.textOnPrimary,
  },
});
