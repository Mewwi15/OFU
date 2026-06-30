/**
 * Expo push registration.
 *
 * Requests notification permission, mints the device's Expo push token, and
 * registers it with the backend (register_push_token RPC). A token can only be
 * minted on a physical device with an EAS projectId configured — on a simulator
 * or without EAS this no-ops quietly (the in-app feed still works).
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerPushToken } from '@/lib/data/notifications';

// Foreground notifications: show a banner + bump the badge.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

function easProjectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

/** Register this device for push. Safe to call on every authed launch. */
export async function registerForPush(): Promise<void> {
  if (!Device.isDevice) return; // simulators can't receive remote push

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'การแจ้งเตือน',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return;

  const projectId = easProjectId();
  if (!projectId) return; // needs an EAS project to mint a token

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerPushToken(token, Platform.OS);
  } catch {
    /* token mint / registration failed (offline, no EAS) — feed still works */
  }
}
