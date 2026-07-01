/**
 * Address book — `/address`.
 *
 * Lists the customer's saved delivery addresses. Tap a card to select it for
 * checkout (radio on the right), edit it (pencil → map picker) or delete it.
 * "เพิ่มที่อยู่ใหม่" opens the map pin picker. The cart reads the selected
 * address in delivery mode.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useAddress, type Address } from '@/store/address';

export default function AddressBookScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();

  const addresses = useAddress((s) => s.addresses);
  const selectedId = useAddress((s) => s.selectedId);
  const select = useAddress((s) => s.select);
  const remove = useAddress((s) => s.remove);

  const confirmDelete = (item: Address) => {
    Alert.alert(
      t('addressList.deleteTitle'),
      `${t('addressList.deletePrefix')}"${item.label}"${t('addressList.deleteSuffix')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('addressList.delete'), style: 'destructive', onPress: () => remove(item.id) },
      ],
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="chevron-back"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
        />
        <Text variant="subtitle">{t('account.menu.address')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.x2 },
        ]}>
        {addresses.map((item) => {
          const active = item.id === selectedId;
          return (
            <PressableScale
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => select(item.id)}
              scaleTo={0.98}
              style={[styles.card, active && styles.cardActive]}>
              <View style={styles.cardTop}>
                <View style={styles.labelPill}>
                  <Ionicons
                    name="location-sharp"
                    size={13}
                    color={Colors.primaryStrong}
                  />
                  <Text style={styles.labelText}>{item.label}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? (
                    <Ionicons name="checkmark" size={14} color={Colors.textOnPrimary} />
                  ) : null}
                </View>
              </View>

              <Text style={styles.recipient}>
                {item.recipient} · {item.phone}
              </Text>
              <Text variant="body" style={styles.line} numberOfLines={2}>
                {item.line}
              </Text>
              {item.detail ? (
                <Text variant="caption" style={styles.detail}>
                  {item.detail}
                </Text>
              ) : null}

              <View style={styles.cardActions}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('addressList.editA11y')}
                  onPress={() => router.push(`/address/picker?id=${item.id}`)}
                  style={styles.actionBtn}>
                  <Ionicons name="create-outline" size={16} color={Colors.text} />
                  <Text style={styles.actionText}>{t('addressList.edit')}</Text>
                </PressableScale>
                {addresses.length > 1 ? (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={t('addressList.deleteTitle')}
                    onPress={() => confirmDelete(item)}
                    style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={16} color={Colors.dangerStrong} />
                    <Text style={[styles.actionText, { color: Colors.dangerStrong }]}>
                      {t('addressList.delete')}
                    </Text>
                  </PressableScale>
                ) : null}
              </View>
            </PressableScale>
          );
        })}

        {/* Add new */}
        <PressableScale
          accessibilityRole="button"
          onPress={() => router.push('/address/picker')}
          scaleTo={0.98}
          style={styles.addCard}>
          <Ionicons name="add-circle-outline" size={22} color={Colors.primaryStrong} />
          <Text style={styles.addText}>{t('addressList.addNew')}</Text>
        </PressableScale>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...Shadow.card,
  },
  cardActive: {
    borderColor: Colors.primary,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  labelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
  },
  labelText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 13,
    color: Colors.primaryStrong,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  recipient: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 15,
    color: Colors.text,
  },
  line: {
    marginTop: 2,
    color: Colors.textMuted,
  },
  detail: {
    marginTop: 2,
    color: Colors.textMuted,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
  },
  actionText: {
    fontFamily: 'Mitr_400Regular',
    fontSize: 13,
    color: Colors.text,
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    backgroundColor: Colors.primaryTint,
  },
  addText: {
    fontFamily: 'Mitr_500Medium',
    fontSize: 15,
    color: Colors.primaryStrong,
  },
});
