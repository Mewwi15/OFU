/**
 * Profile tab — `/account`.
 *
 * The signed-in customer's hub, redesigned for scannability (owner: the old
 * stack "ดูยาก"). One identity card holds avatar/name/member-id, an edit
 * shortcut, and the phone + login-account facts. The menu is grouped into
 * labelled sections (การสั่งซื้อ / การตั้งค่า / เกี่ยวกับ) with single-line rows —
 * no per-row captions. Coral is the sole accent; tokens-only, zero emoji.
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
import { avatarSource } from '@/lib/avatar';
import { getAccountIdentity, type AccountIdentity } from '@/lib/data/auth';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/store/auth';
import { useLock } from '@/store/lock';

/** อู้ฟู่ 3D clay account icons (assets/icon-src/b1–b9). */
const ICON = {
  orders: require('@/assets/icon-src/b1.png') as number,
  address: require('@/assets/icon-src/b2.png') as number,
  settings: require('@/assets/icon-src/b3.png') as number,
  language: require('@/assets/icon-src/b4.png') as number,
  legal: require('@/assets/icon-src/b5.png') as number,
  help: require('@/assets/icon-src/b6.png') as number,
  edit: require('@/assets/icon-src/b7.png') as number,
  member: require('@/assets/icon-src/b8.png') as number,
  logout: require('@/assets/icon-src/b9.png') as number,
};

/** "Google · a@b.com" / "อีเมล · a@b.com" / "โทรศัพท์ · 081…" for the login row. */
function loginAccountLabel(id: AccountIdentity | null, t: (k: string) => string): string {
  if (!id) return '—';
  if (id.provider === 'google') return `Google · ${id.email ?? ''}`.trim();
  if (id.provider === 'email') return `${t('account.loginEmail')} · ${id.email ?? ''}`.trim();
  if (id.provider === 'phone' || id.phone) return `${t('account.loginPhone')} · ${id.phone ?? ''}`.trim();
  return id.provider;
}

const AVATAR_SIZE = 64;

type MenuRow = { key: string; labelKey: string; icon: number };
type MenuSection = { titleKey: string; rows: MenuRow[] };

const SECTIONS: MenuSection[] = [
  {
    titleKey: 'account.sec.shopping',
    rows: [
      { key: 'orders', labelKey: 'account.menu.orders', icon: ICON.orders },
      { key: 'address', labelKey: 'account.menu.address', icon: ICON.address },
    ],
  },
  {
    titleKey: 'account.sec.prefs',
    rows: [
      { key: 'settings', labelKey: 'account.menu.notif', icon: ICON.settings },
      { key: 'language', labelKey: 'account.menu.lang', icon: ICON.language },
    ],
  },
  {
    titleKey: 'account.sec.about',
    rows: [
      { key: 'legal', labelKey: 'account.menu.legal', icon: ICON.legal },
      { key: 'help', labelKey: 'account.menu.help', icon: ICON.help },
    ],
  },
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

  // Sign-out keeps the device PIN: the same account signing back in unlocks
  // with the PIN it already set (ensurePinOwner wipes it only when a DIFFERENT
  // account signs in). Wiping here forced a fresh PIN setup on every re-login.
  // The lock screen's own logout still wipes — that path is the forgot-PIN escape.
  const confirmLogout = () => {
    Alert.alert(t('account.logout'), t('account.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('account.logout'),
        style: 'destructive',
        onPress: () => {
          void logout();
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

        {/* Identity — avatar/name/member id + edit shortcut + account facts */}
        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.profileCard}>
          <View style={styles.idRow}>
            <Image
              source={avatarSource(user.avatar)}
              style={styles.avatar}
              contentFit="cover"
              transition={300}
            />
            <View style={styles.idText}>
              <Text variant="title" numberOfLines={1}>
                {user.name}
              </Text>
              <View style={styles.metaRow}>
                <Image source={ICON.member} style={styles.memberIcon} contentFit="contain" />
                <Text variant="caption" numberOfLines={1}>
                  {t('account.memberId')} {identity ? identity.id.slice(0, 8).toUpperCase() : '—'}
                </Text>
              </View>
            </View>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('account.editProfile')}
              hitSlop={6}
              onPress={() => router.push('/account/edit')}
              style={styles.editBtn}>
              <Image source={ICON.edit} style={styles.editIcon} contentFit="contain" />
            </PressableScale>
          </View>

          <View style={styles.factBox}>
            <View style={styles.factRow}>
              <Text variant="caption" style={styles.factLabel}>
                {t('account.phoneLabel')}
              </Text>
              <Text style={styles.factValue} numberOfLines={1}>
                {user.phone || identity?.phone || t('common.notSet')}
              </Text>
            </View>
            <View style={[styles.factRow, styles.factDivider]}>
              <Text variant="caption" style={styles.factLabel}>
                {t('account.loginAccountLabel')}
              </Text>
              <Text style={styles.factValue} numberOfLines={1}>
                {loginAccountLabel(identity, t)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Grouped menu — single-line rows, no caption noise */}
        {SECTIONS.map((section, s) => (
          <Animated.View
            key={section.titleKey}
            entering={FadeInDown.delay(80 + s * 70).springify().damping(18)}>
            <Text style={styles.eyebrow}>{t(section.titleKey)}</Text>
            <View style={styles.menuCard}>
              {section.rows.map((row, i) => (
                <Pressable
                  key={row.key}
                  accessibilityRole="button"
                  accessibilityLabel={t(row.labelKey)}
                  onPress={() => onRow(row.key)}
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && styles.rowDivider,
                    pressed && styles.rowPressed,
                  ]}>
                  <Image source={row.icon} style={styles.menuIcon} contentFit="contain" />
                  <Text style={styles.rowLabel}>{t(row.labelKey)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </Animated.View>
        ))}

        {/* Sign out */}
        <Animated.View entering={FadeInDown.delay(300).springify().damping(18)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('account.logout')}
            onPress={confirmLogout}
            style={({ pressed }) => [styles.logoutBtn, pressed && styles.rowPressed]}>
            <Image source={ICON.logout} style={styles.logoutIcon} contentFit="contain" />
            <Text style={styles.logoutText}>{t('account.logout')}</Text>
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
    gap: Spacing.lg,
  },
  eyebrow: {
    ...Typography.label,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
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
  memberIcon: { width: 18, height: 18 },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: { width: 22, height: 22 },

  factBox: {
    marginTop: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: Spacing.md,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 40,
  },
  factDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  factLabel: {
    color: Colors.textMuted,
  },
  factValue: {
    ...Typography.bodyStrong,
    fontSize: 14,
    color: Colors.text,
    flexShrink: 1,
    textAlign: 'right',
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
    minHeight: 56,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceMuted,
  },
  menuIcon: { width: 34, height: 34 },
  rowLabel: {
    flex: 1,
    ...Typography.bodyStrong,
    color: Colors.text,
  },

  /* Sign out / delete */
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
  logoutIcon: { width: 24, height: 24 },
  logoutText: {
    ...Typography.button,
    color: Colors.dangerStrong,
  },
});
