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

/**
 * Confirm dialog → resolves true when the user accepts. Web uses
 * window.confirm (Alert buttons never fire there); native shows the standard
 * two-button Alert with the confirm action marked destructive when asked.
 */
export function showConfirm(
  title: string,
  body: string,
  opts: { confirmText: string; cancelText: string; destructive?: boolean },
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${body}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, body, [
      { text: opts.cancelText, style: 'cancel', onPress: () => resolve(false) },
      {
        text: opts.confirmText,
        style: opts.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
