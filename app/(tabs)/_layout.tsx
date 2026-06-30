import { Tabs } from 'expo-router';
import { useEffect } from 'react';

import { TabBar } from '@/components/navigation/TabBar';
import { useCatalog } from '@/store/catalog';

export default function TabLayout() {
  // Load the catalog once when the authed app mounts.
  const loadCatalog = useCatalog((s) => s.load);
  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

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
