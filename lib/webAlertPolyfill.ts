/**
 * Web polyfill for React Native's Alert — react-native-web ships Alert.alert
 * as a NO-OP, which silently swallowed every confirm/error dialog on the web
 * store (logout, checkout errors, slip upload failures, …). Import once from
 * the root layout; native is untouched.
 *
 * Mapping: no/one button → window.alert (then that button's onPress);
 * two+ buttons → window.confirm — OK fires the last non-cancel button,
 * Cancel fires the cancel-style one. Three-button alerts degrade to that
 * same OK/Cancel pair (an acceptable web trade-off).
 */

import { Alert, Platform, type AlertButton } from 'react-native';

if (Platform.OS === 'web') {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = message ? `${title}\n\n${message}` : title;
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const cancel = buttons.find((b) => b.style === 'cancel') ?? buttons[0];
    const confirm = [...buttons].reverse().find((b) => b !== cancel);
    if (window.confirm(text)) confirm?.onPress?.();
    else cancel.onPress?.();
  };
}

export {};
