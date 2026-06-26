import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { AppText } from '@/components/ui/Text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';

/** A single tappable row in the account menu list. */
type MenuRow = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Optional route to navigate to; otherwise the row just logs. */
  href?: string;
  /** Renders the row in the danger color (e.g. logout). */
  danger?: boolean;
};

const MENU_ROWS: MenuRow[] = [
  { key: 'profile', label: 'ข้อมูลส่วนตัว', icon: 'person-outline' },
  { key: 'orders', label: 'ประวัติการสั่งซื้อ', icon: 'receipt-outline' },
  {
    key: 'wishlist',
    label: 'รายการโปรดที่บันทึก',
    icon: 'heart-outline',
    href: '/wishlist',
  },
  { key: 'payment', label: 'ช่องทางชำระเงิน', icon: 'card-outline' },
  { key: 'help', label: 'ศูนย์ช่วยเหลือ', icon: 'help-circle-outline' },
  {
    key: 'logout',
    label: 'ออกจากระบบ',
    icon: 'log-out-outline',
    danger: true,
  },
];

const AVATAR_SIZE = 96;

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.sm },
        ]}
        showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="บัญชีของฉัน"
          right={
            <>
              <IconButton icon="notifications-outline" onPress={() => {}} />
              <IconButton icon="settings-outline" onPress={() => {}} />
            </>
          }
        />

        <Card style={styles.profileCard} padding={Spacing.xl}>
          <View style={styles.avatarWrap}>
            <Image
              source={{ uri: 'https://i.pravatar.cc/300?img=47' }}
              style={styles.avatar}
              contentFit="cover"
              transition={300}
            />
            <IconButton
              icon="pencil"
              variant="primary"
              size={32}
              onPress={() => {}}
              style={styles.editPencil}
            />
          </View>
          <AppText variant="h1" style={styles.profileName}>
            คุณอู้ฟู่
          </AppText>
          <AppText variant="body" color={Colors.textMuted}>
            oofoo@email.com
          </AppText>
        </Card>

        <Card style={styles.menuCard} padding={0}>
          {MENU_ROWS.map((row, index) => (
            <MenuItem
              key={row.key}
              row={row}
              isLast={index === MENU_ROWS.length - 1}
              onPress={() => {
                if (row.href) {
                  router.push(row.href as never);
                } else {
                  console.log(`Account menu: ${row.label}`);
                }
              }}
            />
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

function MenuItem({
  row,
  isLast,
  onPress,
}: {
  row: MenuRow;
  isLast: boolean;
  onPress: () => void;
}) {
  const tint = row.danger ? Colors.danger : Colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}>
      <View style={styles.iconCircle}>
        <Ionicons
          name={row.icon}
          size={20}
          color={row.danger ? Colors.danger : Colors.primary}
        />
      </View>
      <AppText variant="h2" color={tint} style={styles.rowLabel}>
        {row.label}
      </AppText>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={row.danger ? Colors.danger : Colors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    // Leave room for the floating tab bar.
    paddingBottom: 110,
    gap: Spacing.xl,
  },
  profileCard: {
    alignItems: 'center',
  },
  avatarWrap: {
    marginBottom: Spacing.md,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
  },
  editPencil: {
    position: 'absolute',
    right: -Spacing.xs,
    bottom: -Spacing.xs,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  profileName: {
    marginBottom: Spacing.xs,
  },
  menuCard: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowPressed: {
    backgroundColor: Colors.backgroundAlt,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
  },
});
