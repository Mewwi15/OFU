/**
 * Web-only global CSS: drop the browser's default blue focus ring on text
 * fields — the app's inputs carry their own focused styling and the ring
 * reads as a glitch on the phone-styled layout. Keyboard users still get
 * the ring on buttons/links via :focus-visible, which this doesn't touch.
 */

import { Platform } from 'react-native';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.id = 'oofoo-focus-style';
  style.textContent = 'input:focus, textarea:focus { outline: none !important; }';
  document.head.appendChild(style);
}

export {};
