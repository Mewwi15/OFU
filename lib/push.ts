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
import { Linking, Platform } from 'react-native';

import { registerPushToken } from '@/lib/data/notifications';

/** The custom notification sound bundled via the expo-notifications plugin
 *  (app.json `sounds`). On Android it's referenced on the channel by its base
 *  filename; on iOS the sender sets it on the notification `sound`. */
export const NOTIFICATION_SOUND = 'notification.wav';
/** Android channel id. Bumped from the old soundless 'default' so devices that
 *  already created that channel pick up the sounded one — Android freezes a
 *  channel's settings after first creation, so a fresh id is the only way an
 *  existing install starts making sound without a reinstall. */
export const ANDROID_CHANNEL_ID = 'default-v2';

// Foreground notifications: show a banner, PLAY THE SOUND, bump the badge. (Not
// on web — the site relies on the in-app feed, no browser push.)
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

function easProjectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

/**
 * The outcome of a push registration attempt, so callers/diagnostics can tell
 * WHY there's no push instead of a silent nothing:
 *  - 'granted'        token minted and registered with the backend
 *  - 'denied'         the OS permission was denied (offer a route to Settings)
 *  - 'unsupported'    web, an iOS simulator, or no EAS projectId — nothing to do
 *  - 'token_failed'   permission ok, but minting the Expo token threw (offline,
 *                     or missing APNs/FCM credentials) — retryable
 *  - 'backend_failed' token minted, but registering it with the backend threw
 *                     (offline / RPC error) — retryable
 */
export type PushRegisterStatus =
  | 'granted'
  | 'denied'
  | 'unsupported'
  | 'token_failed'
  | 'backend_failed';

/** True for statuses worth retrying when the network/app state changes. */
export function isRetryablePushStatus(s: PushRegisterStatus): boolean {
  return s === 'token_failed' || s === 'backend_failed';
}

/** Open the OS notification settings for this app (for the denied case). */
export async function openNotificationSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    /* some OEMs restrict this — nothing better to do */
  }
}

/**
 * Register this device for push. Safe to call on every authed launch. Returns a
 * status instead of swallowing failures, so the UI can react (retry, or point a
 * denied user at Settings) and telemetry can see production breakage.
 */
export async function registerForPush(): Promise<PushRegisterStatus> {
  // No browser push on web (would need VAPID + a service worker; the in-app
  // notification feed covers it). Don't prompt for permission there.
  if (Platform.OS === 'web') return 'unsupported';
  // iOS simulators can't receive remote push. Android emulators with Google
  // Play services CAN (FCM works there), so only gate iOS.
  if (!Device.isDevice && Platform.OS === 'ios') return 'unsupported';

  if (Platform.OS === 'android') {
    // HIGH so a new order actually alerts (heads-up + sound); the sound is the
    // bundled file, referenced by base filename per the expo-notifications docs.
    // Android 13 requires the channel to exist before the token is minted.
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'การแจ้งเตือน',
      importance: Notifications.AndroidImportance.HIGH,
      sound: NOTIFICATION_SOUND,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return 'denied';

  const projectId = easProjectId();
  if (!projectId) return 'unsupported'; // needs an EAS project to mint a token

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return 'token_failed'; // offline, or APNs/FCM credentials not wired
  }
  try {
    await registerPushToken(token, Platform.OS);
  } catch {
    return 'backend_failed'; // token is fine; the backend register call failed
  }
  return 'granted';
}
