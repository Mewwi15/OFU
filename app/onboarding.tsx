/**
 * Onboarding / Get Started — `/onboarding`.
 *
 * Shown once on first launch (gated by the lock store's `onboarded` flag). A
 * short three-slide intro to อู้ฟู่; finishing marks onboarding done and the
 * root gate hands off to /login. Tokens only, zero emoji, Mitr.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useLock } from '@/store/lock';

type Slide = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  bodyKey: string;
};

const SLIDES: Slide[] = [
  {
    id: 's1',
    icon: 'leaf-outline',
    titleKey: 'onboarding.slide1Title',
    bodyKey: 'onboarding.slide1Body',
  },
  {
    id: 's2',
    icon: 'bicycle-outline',
    titleKey: 'onboarding.slide2Title',
    bodyKey: 'onboarding.slide2Body',
  },
  {
    id: 's3',
    icon: 'shield-checkmark-outline',
    titleKey: 'onboarding.slide3Title',
    bodyKey: 'onboarding.slide3Body',
  },
];

export default function OnboardingScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const completeOnboarding = useLock((s) => s.completeOnboarding);

  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const ref = useRef<ScrollView>(null);

  const isLast = index === SLIDES.length - 1;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) return;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const next = () => {
    if (isLast) {
      completeOnboarding();
      return;
    }
    ref.current?.scrollTo({ x: (index + 1) * width, animated: true });
    setIndex(index + 1);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Skip */}
      <View style={styles.topBar}>
        {!isLast ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.skip')}
            hitSlop={10}
            onPress={() => completeOnboarding()}>
            <Text style={styles.skip}>{t('onboarding.skip')}</Text>
          </PressableScale>
        ) : null}
      </View>

      {/* Slides */}
      <View style={styles.carousel} onLayout={onLayout}>
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}>
          {SLIDES.map((slide) => (
            <View key={slide.id} style={[styles.slide, { width }]}>
              <View style={styles.art}>
                <Ionicons name={slide.icon} size={92} color={Colors.primaryStrong} />
              </View>
              <Text variant="title" style={styles.title}>
                {t(slide.titleKey)}
              </Text>
              <Text variant="body" style={styles.body}>
                {t(slide.bodyKey)}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View key={slide.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Animated.View entering={FadeIn.duration(200)} style={styles.ctaWrap}>
          <Button onPress={next} style={styles.cta}>
            {isLast ? t('onboarding.getStarted') : t('onboarding.next')}
          </Button>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    height: 44,
    paddingHorizontal: Spacing.lg,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skip: {
    ...Typography.button,
    color: Colors.textMuted,
  },
  carousel: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.x2,
  },
  art: {
    width: 180,
    height: 180,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.x3,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    marginTop: Spacing.md,
    textAlign: 'center',
    color: Colors.textMuted,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 22,
    backgroundColor: Colors.primary,
  },
  ctaWrap: {
    width: '100%',
  },
  cta: {
    width: '100%',
  },
});
