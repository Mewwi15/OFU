import { Tabs } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';

import { TabBar } from '@/components/navigation/TabBar';
import {
  isRetryablePushStatus,
  openNotificationSettings,
  registerForPush,
  type PushRegisterStatus,
} from '@/lib/push';
import { useAddress } from '@/store/address';
import { useCatalog } from '@/store/catalog';
import { useNotifications } from '@/store/notifications';
import { useFees } from '@/store/mode';
import { useShop } from '@/store/shop';

export default function TabLayout() {
  // Load the catalog + address book + shop info + notifications once on mount.
  const loadCatalog = useCatalog((s) => s.load);
  const loadAddresses = useAddress((s) => s.load);
  const loadShop = useShop((s) => s.load);
  const loadFees = useFees((s) => s.load);
  const loadNotifications = useNotifications((s) => s.load);

  // Push registration: prompt a denied user toward Settings once, and retry a
  // transient failure (offline/backend) when the app next comes to foreground.
  const lastPushStatus = useRef<PushRegisterStatus | null>(null);
  const deniedPrompted = useRef(false);

  useEffect(() => {
    loadCatalog();
    loadAddresses();
    loadShop();
    loadFees();
    loadNotifications();

    let cancelled = false;
    const attempt = async () => {
      const status = await registerForPush();
      if (cancelled) return;
      lastPushStatus.current = status;
      if (status === 'denied' && !deniedPrompted.current) {
        deniedPrompted.current = true;
        Alert.alert(
          'การแจ้งเตือนถูกปิดอยู่',
          'เปิดการแจ้งเตือนในการตั้งค่า เพื่อรับแจ้งเมื่อสถานะออเดอร์เปลี่ยน',
          [
            { text: 'ไว้ก่อน', style: 'cancel' },
            { text: 'ไปที่การตั้งค่า', onPress: () => void openNotificationSettings() },
          ],
        );
      }
    };
    void attempt();

    // Coming back to foreground is the cheap proxy for "network is back": retry
    // only the transient failures (never re-prompt a denial here).
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && lastPushStatus.current && isRetryablePushStatus(lastPushStatus.current)) {
        void attempt();
      }
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [loadCatalog, loadAddresses, loadShop, loadFees, loadNotifications]);

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
