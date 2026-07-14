/**
 * Root-level error boundary. React only catches render-time throws in a
 * class component (getDerivedStateFromError/componentDidCatch — there is no
 * hook equivalent), so this stays a class despite the rest of the app being
 * function components. Wraps the whole Stack in app/_layout.tsx: without it,
 * a throw in any screen white-screens the entire storefront with no way back
 * except guessing to reload — now the only customer channel (native is
 * parked), so this is the difference between "annoying" and "the shop looks
 * broken with no recourse".
 */
import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/theme';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // No remote error tracking is wired up yet — at least land it in devtools
    // so a report ("เว็บขาว") has something to grep for.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reload = () => {
    if (typeof window !== 'undefined' && 'location' in window) {
      window.location.reload();
    } else {
      // Native has no location.reload — clearing the error lets the tree
      // remount; if the same screen throws again the boundary catches it again.
      this.setState({ error: null });
    }
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text variant="title" style={styles.title}>
            เกิดข้อผิดพลาด
          </Text>
          <Text variant="body" style={styles.body}>
            หน้านี้ขัดข้องกะทันหัน ลองโหลดหน้าใหม่อีกครั้ง — ตะกร้าสินค้าของคุณถูกบันทึกไว้แล้ว ไม่หายไปไหน
          </Text>
          <Pressable accessibilityRole="button" onPress={this.reload} style={styles.button}>
            <Text style={styles.buttonText}>โหลดหน้าใหม่</Text>
          </Pressable>
          <Text variant="caption" style={styles.detail} numberOfLines={3}>
            {error.message}
          </Text>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.x2,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.x2,
    alignItems: 'center',
    ...Shadow.card,
  },
  title: { color: Colors.text, marginBottom: Spacing.sm, textAlign: 'center' },
  body: { color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.lg },
  button: {
    minHeight: 52,
    minWidth: 180,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  buttonText: { ...Typography.button, color: Colors.textOnPrimary },
  detail: { color: Colors.textMuted, marginTop: Spacing.lg, textAlign: 'center' },
});
