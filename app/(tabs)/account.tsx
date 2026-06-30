/**
 * Profile tab — `/account`.
 *
 * The signed-in customer's hub: an identity card (avatar + name + phone + email
 * + Edit) over a short menu (orders, help) and a sign-out action. Reads the user
 * from the auth store. Coral is the sole accent; tokens-only, zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { deleteAccount, getAccountIdentity, type AccountIdentity } from '@/lib/data/auth';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/store/auth';
import { useLock } from '@/store/lock';

/** "Google · a@b.com" / "Phone · 081…" for the login-account row. */
function loginAccountLabel(id: AccountIdentity | null, phoneLabel: string): string {
  if (!id) return '—';
  if (id.provider === 'google') return `Google · ${id.email ?? ''}`.trim();
  if (id.provider === 'phone' || id.phone) return `${phoneLabel} · ${id.phone ?? ''}`.trim();
  return id.provider;
}

const AVATAR_SIZE = 64;

type MenuRow = {
  key: string;
  labelKey: string;
  capKey: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const MENU_ROWS: MenuRow[] = [
  { key: 'orders', labelKey: 'account.menu.orders', capKey: 'account.menu.ordersCap', icon: 'receipt-outline' },
  { key: 'address', labelKey: 'account.menu.address', capKey: 'account.menu.addressCap', icon: 'location-outline' },
  { key: 'settings', labelKey: 'account.menu.notif', capKey: 'account.menu.notifCap', icon: 'notifications-outline' },
  { key: 'language', labelKey: 'account.menu.lang', capKey: 'account.menu.langCap', icon: 'language-outline' },
  { key: 'legal', labelKey: 'account.menu.legal', capKey: 'account.menu.legalCap', icon: 'document-text-outline' },
  { key: 'help', labelKey: 'account.menu.help', capKey: 'account.menu.helpCap', icon: 'help-buoy-outline' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const resetLock = useLock((s) => s.resetLock);
  const [identity, setIdentity] = useState<AccountIdentity | null>(null);
  const t = useT();

  useFocusEffect(
    useCallback(() => {
      getAccountIdentity()
        .then(setIdentity)
        .catch(() => {});
    }, []),
  );

  const onRow = (key: string) => {
    switch (key) {
      case 'orders':
        router.navigate('/orders');
        break;
      case 'address':
        router.push('/address');
        break;
      case 'settings':
        router.push('/account/settings');
        break;
      case 'language':
        router.push('/account/language');
        break;
      case 'legal':
        router.push('/account/legal');
        break;
      case 'help':
        Alert.alert(t('account.menu.help'), t('account.helpBody'));
        break;
    }
  };

  const confirmDelete = () => {
    Alert.alert(t('account.delete'), t('account.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('account.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAccount();
            await resetLock();
            logout();
          } catch {
            Alert.alert(t('account.deleteFailed'), t('common.tryAgain'));
          }
        },
      },
    ]);
  };

  const confirmLogout = () => {
    Alert.alert(t('account.logout'), t('account.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('account.logout'),
        style: 'destructive',
        onPress: async () => {
          await resetLock();
          logout();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.sm, paddingBottom: 110 + insets.bottom },
        ]}>
        <ScreenHeader
          title={t('account.title')}
          right={
            <IconButton
              icon="notifications-outline"
              accessibilityLabel={t('account.notifications')}
              onPress={() => router.push('/notifications')}
            />
          }
        />

        {/* Identity */}
        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.profileCard}>
          <View style={styles.idRow}>
            <Image
              source={{ uri: user.avatar }}
              style={styles.avatar}
              contentFit="cover"
              transition={300}
            />
            <View style={styles.idText}>
              <Text variant="title" numberOfLines={1}>
                {user.name}
              </Text>
              <View style={styles.metaRow}>
                <Ionicons name="card-outline" size={13} color={Colors.textMuted} />
                <Text variant="caption" numberOfLines={1}>
                  {t('account.memberId')} {identity ? identity.id.slice(0, 8).toUpperCase() : '—'}
                </Text>
              </View>
            </View>
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="แก้ไขโปรไฟล์"
            onPress={() => router.push('/account/edit')}
            style={styles.editBtn}>
            <Ionicons name="create-outline" size={16} color={Colors.primaryStrong} />
            <Text style={styles.editText}>{t('account.editProfile')}</Text>
          </PressableScale>
        </Animated.View>

        {/* Identity info */}
        <Animated.View
          entering={FadeInDown.delay(80).springify().damping(18)}
          style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text variant="caption" style={styles.infoLabel}>
              {t('account.phoneLabel')}
            </Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {user.phone || identity?.phone || t('common.notSet')}
            </Text>
          </View>
          <View style={[styles.infoRow, styles.infoDivider]}>
            <Text variant="caption" style={styles.infoLabel}>
              {t('account.loginAccountLabel')}
            </Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {loginAccountLabel(identity, t('account.loginPhone'))}
            </Text>
          </View>
        </Animated.View>

        {/* Menu */}
        <View style={styles.menuCard}>
          {MENU_ROWS.map((row, i) => (
            <Animated.View
              key={row.key}
              entering={FadeInDown.delay(120 + i * 70).springify().damping(18)}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(row.labelKey)}
                onPress={() => onRow(row.key)}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && styles.rowDivider,
                  pressed && styles.rowPressed,
                ]}>
                <View style={styles.iconTile}>
                  <Ionicons name={row.icon} size={20} color={Colors.primaryStrong} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{t(row.labelKey)}</Text>
                  <Text variant="caption" numberOfLines={1}>
                    {t(row.capKey)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </Pressable>
            </Animated.View>
          ))}
        </View>

        {/* Sign out */}
        <Animated.View entering={FadeInDown.delay(280).springify().damping(18)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('account.logout')}
            onPress={confirmLogout}
            style={({ pressed }) => [styles.logoutBtn, pressed && styles.rowPressed]}>
            <Ionicons name="log-out-outline" size={20} color={Colors.dangerStrong} />
            <Text style={styles.logoutText}>{t('account.logout')}</Text>
          </Pressable>
        </Animated.View>

        {/* Delete account (PDPA) */}
        <Animated.View entering={FadeInDown.delay(340).springify().damping(18)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('account.delete')}
            onPress={confirmDelete}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.rowPressed]}>
            <Text style={styles.deleteText}>{t('account.delete')}</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
  },

  /* Identity */
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadow.card,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
  },
  idText: {
    flex: 1,
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 44,
    marginTop: Spacing.lg,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
  },
  editText: {
    ...Typography.button,
    color: Colors.primaryStrong,
  },

  /* Menu */
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceMuted,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowLabel: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },

  /* Sign out */
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  logoutText: {
    ...Typography.button,
    color: Colors.dangerStrong,
  },

  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    ...Shadow.card,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  infoDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  infoLabel: {
    color: Colors.textMuted,
  },
  infoValue: {
    ...Typography.bodyStrong,
    color: Colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },

  deleteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: Spacing.xs,
  },
  deleteText: {
    ...Typography.body,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
});
