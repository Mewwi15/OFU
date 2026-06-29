/**
 * Profile tab — `/account`.
 *
 * The signed-in customer's hub: an identity card (avatar + name + phone + email
 * + Edit) over a short menu (orders, help) and a sign-out action. Reads the user
 * from the auth store. Coral is the sole accent; tokens-only, zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/store/auth';
import { useLock } from '@/store/lock';

const AVATAR_SIZE = 64;

type MenuRow = {
  key: string;
  label: string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const MENU_ROWS: MenuRow[] = [
  { key: 'orders', label: 'คำสั่งซื้อของฉัน', caption: 'ดูออเดอร์ที่ผ่านมาและกำลังดำเนินการ', icon: 'receipt-outline' },
  { key: 'help', label: 'ศูนย์ช่วยเหลือ', caption: 'ติดต่อเราหรือคำถามที่พบบ่อย', icon: 'help-buoy-outline' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const resetLock = useLock((s) => s.resetLock);

  const onRow = (key: string) => {
    switch (key) {
      case 'orders':
        router.navigate('/orders');
        break;
      case 'help':
        Alert.alert('ศูนย์ช่วยเหลือ', 'ติดต่อทีมงานอู้ฟู่ได้ที่ 02-000-0000 ทุกวัน 8:00-22:00 น.');
        break;
    }
  };

  const confirmLogout = () => {
    Alert.alert('ออกจากระบบ', 'ต้องการออกจากระบบใช่ไหม?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ออกจากระบบ',
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
          title="บัญชีของฉัน"
          right={
            <IconButton
              icon="notifications-outline"
              accessibilityLabel="การแจ้งเตือน"
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
              {user.phone ? (
                <View style={styles.metaRow}>
                  <Ionicons name="call-outline" size={13} color={Colors.textMuted} />
                  <Text variant="caption" numberOfLines={1}>
                    {user.phone}
                  </Text>
                </View>
              ) : null}
              <View style={styles.metaRow}>
                <Ionicons name="mail-outline" size={13} color={Colors.textMuted} />
                <Text variant="caption" numberOfLines={1}>
                  {user.email || 'ยังไม่ได้เพิ่มอีเมล'}
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
            <Text style={styles.editText}>แก้ไขโปรไฟล์</Text>
          </PressableScale>
        </Animated.View>

        {/* Menu */}
        <View style={styles.menuCard}>
          {MENU_ROWS.map((row, i) => (
            <Animated.View
              key={row.key}
              entering={FadeInDown.delay(120 + i * 70).springify().damping(18)}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={row.label}
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
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text variant="caption" numberOfLines={1}>
                    {row.caption}
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
            accessibilityLabel="ออกจากระบบ"
            onPress={confirmLogout}
            style={({ pressed }) => [styles.logoutBtn, pressed && styles.rowPressed]}>
            <Ionicons name="log-out-outline" size={20} color={Colors.dangerStrong} />
            <Text style={styles.logoutText}>ออกจากระบบ</Text>
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
});
