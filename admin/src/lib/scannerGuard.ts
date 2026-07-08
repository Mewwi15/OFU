/**
 * Scanner guard — neutralise the Zebra's "keypad emulation" side effects.
 *
 * The shop's DS2208 sends every character as a Windows alt-code: Alt held +
 * the ASCII code typed on the NUMPAD. Without NumLock semantics those numpad
 * keys double as navigation keys, and with Alt held they hit BROWSER shortcuts:
 *
 *   digit needs → numpad key → browser shortcut
 *   ...4...     → Numpad4 = ArrowLeft  → Alt+Left  = history BACK
 *   ...6...     → Numpad6 = ArrowRight → Alt+Right = history FORWARD
 *   ...7...     → Numpad7 = Home       → Alt+Home  = go to HOMEPAGE  ← เลข 9 (0057)
 *
 * So a barcode containing 0/6 pressed Back, and one containing 9 jumped the
 * whole tab to the browser homepage (caught red-handed by the flight recorder).
 *
 * Block the browser default for EVERY Alt+Numpad digit. The flight-recorder
 * tapes prove character composition is unaffected (it happens at the OS layer
 * on Alt-release): scans with Numpad4/6 already blocked still typed complete
 * codes. A human pressing Alt+ArrowLeft on the arrow cluster (different
 * e.code) still works.
 */
export function installScannerGuard() {
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.altKey && /^Numpad\d$/.test(e.code)) {
        e.preventDefault();
      }
    },
    { capture: true },
  );
}
