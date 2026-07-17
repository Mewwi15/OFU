/**
 * ⚠️ TEMPORARY DIAGNOSTIC — DELETE BEFORE THE STORE BUILD. ⚠️
 *
 * Why this exists: the login screen reports its title under the status bar and
 * the privacy link under the Android nav buttons, even though the padding maths
 * reads correct. Every remote theory has been wrong so far (the missing
 * react-native-edge-to-edge package turned out to be expected on SDK 54), so
 * this stops guessing and reads the actual numbers off the device.
 *
 * It is on screen rather than in `console.log` on purpose: the build is a
 * standalone APK with no debugger attached, so a log goes nowhere. The owner
 * photographs this instead.
 *
 * TWO RULES THIS COMPONENT MUST OBEY:
 *  1. It must NOT position itself with safe-area insets. Insets are the thing
 *     under suspicion — a probe that hides under the status bar when insets are
 *     broken tells us nothing. It pins to the VERTICAL MIDDLE, the one band of
 *     the screen no system bar can ever cover.
 *  2. `pointerEvents="none"` so it can't block the login form underneath — the
 *     same build still has to be usable for testing Google/Apple sign-in.
 *
 * TO REMOVE: delete the `<SafeAreaProbe … />` line in app/login.tsx and this
 * file. Nothing else imports it. It also reaches into
 * `react-native-is-edge-to-edge`, which is a TRANSITIVE dep (pulled in by
 * react-native-safe-area-context, not declared in package.json) — acceptable
 * for throwaway diagnostics, another reason this must not ship.
 */

import {
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  isEdgeToEdge,
  isEdgeToEdgeFromLibrary,
  isEdgeToEdgeFromProperty,
} from 'react-native-is-edge-to-edge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  /** The paddingTop the screen ACTUALLY applied this render (not re-derived). */
  padTop: number;
  /** The paddingBottom the screen ACTUALLY applied this render. */
  padBottom: number;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function SafeAreaProbe({ padTop, padBottom }: Props) {
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const screen = Dimensions.get('screen');

  // The tell: if window == screen the app IS drawing under the system bars, so
  // insets MUST be non-zero. If window is shorter, the system is reserving the
  // space itself and zero insets would be correct.
  const dW = Math.round(screen.width - win.width);
  const dH = Math.round(screen.height - win.height);

  const n = (v: number | undefined) => (v === undefined ? '–' : String(Math.round(v)));

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Text style={styles.title}>SAFE-AREA PROBE · TEMPORARY</Text>
      <Row label="platform" value={`${Platform.OS} API ${String(Platform.Version)}`} />
      <Row
        label="insets"
        value={`T${n(insets.top)} B${n(insets.bottom)} L${n(insets.left)} R${n(insets.right)}`}
      />
      <Row label="StatusBar.currentHeight" value={n(StatusBar.currentHeight)} />
      <Row label="window" value={`${n(win.width)} x ${n(win.height)}`} />
      <Row label="screen" value={`${n(screen.width)} x ${n(screen.height)}`} />
      <Row label="screen-window" value={`${dW} x ${dH}`} />
      <Row
        label="edgeToEdge"
        value={`${String(isEdgeToEdge())} (lib ${String(isEdgeToEdgeFromLibrary())} / prop ${String(
          isEdgeToEdgeFromProperty(),
        )})`}
      />
      <Row label="padTop USED" value={n(padTop)} />
      <Row label="padBottom USED" value={n(padBottom)} />
      <Text style={styles.footer}>photograph this →send to Mira</Text>
    </View>
  );
}

/* Deliberately hardcoded colours, not theme tokens: this must stay legible in a
   photo regardless of light/dark, and it is being deleted anyway. */
const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    // Vertical middle — never under a status bar or nav bar, whatever the
    // insets turn out to be. NOT inset-derived, on purpose.
    top: '34%',
    left: 8,
    right: 8,
    zIndex: 9999,
    elevation: 9999,
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#00FF66',
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  title: {
    color: '#00FF66',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: '#9BE7B4',
    fontSize: 11,
    ...Platform.select({ android: { fontFamily: 'monospace' }, ios: { fontFamily: 'Menlo' } }),
  },
  value: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    ...Platform.select({ android: { fontFamily: 'monospace' }, ios: { fontFamily: 'Menlo' } }),
  },
  footer: {
    color: '#9BE7B4',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
  },
});
