import { Tabs } from 'expo-router';
import { useEffect } from 'react';

import { TabBar } from '@/components/navigation/TabBar';
import { registerForPush } from '@/lib/push';
import { useAddress } from '@/store/address';
import { useCatalog } from '@/store/catalog';
import { useNotifications } from '@/store/notifications';
import { useShop } from '@/store/shop';

export default function TabLayout() {
  // Load the catalog + address book + shop info + notifications once on mount.
  const loadCatalog = useCatalog((s) => s.load);
  const loadAddresses = useAddress((s) => s.load);
  const loadShop = useShop((s) => s.load);
  const loadNotifications = useNotifications((s) => s.load);
  useEffect(() => {
    loadCatalog();
    loadAddresses();
    loadShop();
    loadNotifications();
    void registerForPush();
  }, [loadCatalog, loadAddresses, loadShop, loadNotifications]);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders' }} />
      <Tabs.Screen name="cart" options={{ title: 'Cart' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
