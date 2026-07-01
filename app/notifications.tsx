/**
 * Notifications — `/notifications`.
 *
 * The activity feed: a filter row (ทั้งหมด / คำสั่งซื้อ / โปรโมชั่น) over a list
 * of notifications, each a kind-tinted icon tile with title, time and body.
 * Unread items carry a coral dot. Tokens-only, zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Breathing } from '@/components/ui/Breathing';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { type NotificationKind } from '@/data/fulfillment';
import { useT } from '@/lib/i18n';
import { unreadCount, useNotifications } from '@/store/notifications';

type Filter = 'all' | NotificationKind;

const FILTERS: Filter[] = ['all', 'order', 'promo'];

export default function NotificationsScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');

  const all = useNotifications((s) => s.items);
  const load = useNotifications((s) => s.load);
  const markRead = useNotifications((s) => s.markRead);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const unread = useNotifications(unreadCount);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const items = useMemo(
    () => (filter === 'all' ? all : all.filter((n) => n.kind === filter)),
    [filter, all],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={t('notif.title')}
        style={styles.header}
        left={
          <IconButton icon="chevron-back" accessibilityLabel={t('common.back')} onPress={() => router.back()} />
        }
        right={
          unread > 0 ? (
            <IconButton
              icon="checkmark-done"
              accessibilityLabel={t('notif.markAllRead')}
              onPress={() => void markAllRead()}
            />
          ) : undefined
        }
      />

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}>
        {FILTERS.map((key) => (
          <Chip
            key={key}
            label={t(`notif.filter.${key}`)}
            active={key === filter}
            onPress={() => setFilter(key)}
          />
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.x2 }]}>
        {items.map((n, i) => {
          const promo = n.kind === 'promo';
          return (
            <Animated.View
              key={n.id}
              entering={FadeInDown.delay(i * 70).springify().damping(18)}
              layout={LinearTransition.springify()}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${t('notif.readItem')} ${n.title}`}
                scaleTo={0.98}
                onPress={() => n.unread && markRead(n.id)}
                style={styles.row}>
                <View style={[styles.iconTile, promo ? styles.iconTilePromo : styles.iconTileOrder]}>
                  <Ionicons
                    name={n.icon}
                    size={20}
                    color={promo ? Colors.accentStrong : Colors.primaryStrong}
                  />
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {n.title}
                    </Text>
                    <Text variant="caption" style={styles.rowTime}>
                      {n.time}
                    </Text>
                  </View>
                  <Text variant="caption" style={styles.rowText}>
                    {n.body}
                  </Text>
                </View>
                {n.unread ? (
                  <Breathing amount={0.35} duration={1100}>
                    <View style={styles.unreadDot} />
                  </Breathing>
                ) : null}
              </PressableScale>
            </Animated.View>
          );
        })}

        {items.length === 0 ? (
          <Text variant="body" style={styles.empty}>
            {t('notif.empty')}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileOrder: {
    backgroundColor: Colors.primaryTint,
  },
  iconTilePromo: {
    backgroundColor: Colors.accentTint,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowTitle: {
    flex: 1,
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  rowTime: {
    color: Colors.textMuted,
  },
  rowText: {
    lineHeight: 19,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    marginTop: Spacing.xs,
  },
  empty: {
    textAlign: 'center',
    color: Colors.textMuted,
    paddingTop: Spacing.x3,
  },
});
