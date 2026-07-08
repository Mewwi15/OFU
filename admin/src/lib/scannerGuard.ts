/**
 * Scanner guard — neutralise the Zebra's "keypad emulation" side effects.
 *
 * The shop's DS2208 sends every character as a Windows alt-code: Alt held +
 * the ASCII code typed on the NUMPAD. With NumLock semantics off, Numpad4 and
 * Numpad6 are ArrowLeft/ArrowRight — so Alt+Numpad4 IS Chrome's "history back"
 * shortcut. Any barcode whose alt-codes contain a 4 or 6 (e.g. every digit 0 =
 * 0048, 6 = 0054) navigated the till away mid-scan ("ยิงแล้วเด้งหน้า").
 *
 * Block the browser default ONLY for Alt+Numpad4/6 (identified by e.code, so a
 * human pressing Alt+ArrowLeft on the arrow cluster still works). Character
 * composition happens at the OS layer on Alt-release and is not affected.
 */
export function installScannerGuard() {
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.altKey && (e.code === 'Numpad4' || e.code === 'Numpad6')) {
        e.preventDefault();
      }
    },
    { capture: true },
  );
}
