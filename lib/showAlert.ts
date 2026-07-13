/**
 * Cross-platform alert. React Native's Alert.alert is a SILENT NO-OP on web —
 * every error/permission dialog routed through it simply vanishes there. Use
 * this instead anywhere a screen also runs on web.
 */

import { Alert, Platform } from 'react-native';

export function showAlert(title: string, body?: string): void {
  if (Platform.OS === 'web') {
    window.alert(body ? `${title}\n\n${body}` : title);
    return;
  }
  Alert.alert(title, body);
}
