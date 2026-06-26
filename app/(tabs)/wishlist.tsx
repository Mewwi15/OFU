/**
 * Wishlist screen.
 *
 * Header: centered "Wishlist" title with bell + bag IconButtons on the right.
 * Body: a FlatList of ProductListItem (variant="wishlist") for every wishlisted
 * product. Tapping a row's heart removes it from the wishlist (handled inside
 * ProductListItem via the wishlist store). When the list is empty, a friendly
 * empty state is shown instead.
 */

import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { ProductListItem } from '@/components/product/ProductListItem';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useWishlist, wishlistProducts } from '@/store/wishlist';

// Floating tab bar clearance so content is never hidden behind it.
const TAB_BAR_CLEARANCE = 110;

export default function WishlistScreen() {
  const router = useRouter();
  const items = wishlistProducts(useWishlist((s) => s.ids));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader
        title="รายการโปรด"
        style={styles.header}
        right={
          <>
            <IconButton icon="notifications-outline" onPress={() => {}} />
            <IconButton icon="bag-outline" onPress={() => router.push('/cart')} />
          </>
        }
      />

      {items.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="heart-outline"
              size={48}
              color={Colors.primary}
            />
          </View>
          <Text variant="subtitle" style={styles.emptyTitle}>
            ยังไม่มีรายการโปรด
          </Text>
          <Text
            variant="body"
            style={[{ color: Colors.textMuted }, styles.emptyBody]}>
            แตะรูปหัวใจที่สินค้าเพื่อบันทึกไว้ดูภายหลัง
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(product) => product.id}
          renderItem={({ item }) => (
            <ProductListItem product={item} variant="wishlist" />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={Separator}
        />
      )}
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  separator: {
    height: Spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.x2,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    marginBottom: Spacing.xs,
  },
  emptyBody: {
    textAlign: 'center',
  },
});
