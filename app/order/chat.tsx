/**
 * Rider chat — `/order/chat`.
 *
 * Customer ↔ rider messaging during a delivery. Customer bubbles are coral and
 * right-aligned; rider bubbles are muted and left-aligned. The header carries
 * the rider name + a call action; the composer sends a message. Tokens-only,
 * zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TypingDots } from '@/components/order/TypingDots';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { MOCK_RIDER } from '@/data/fulfillment';
import { useChat } from '@/store/chat';
import { useOrder } from '@/store/order';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const messages = useChat((s) => s.messages);
  const send = useChat((s) => s.send);
  const riderReply = useChat((s) => s.riderReply);
  const rider = useOrder((s) => s.active?.rider) ?? MOCK_RIDER;

  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasDraft = draft.trim().length > 0;

  // Animate the send button between idle (small, faded) and ready (full).
  const sendProgress = useSharedValue(0);
  useEffect(() => {
    sendProgress.value = withSpring(hasDraft ? 1 : 0, { damping: 14, stiffness: 220 });
  }, [hasDraft, sendProgress]);
  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.85 + sendProgress.value * 0.15 }],
    opacity: 0.4 + sendProgress.value * 0.6,
  }));

  useEffect(() => () => {
    if (replyTimer.current) clearTimeout(replyTimer.current);
  }, []);

  const onSend = () => {
    const text = draft.trim();
    if (!text) return;
    send(text);
    setDraft('');
    // Rider "types", then replies — keeps the demo conversation lively.
    setTyping(true);
    if (replyTimer.current) clearTimeout(replyTimer.current);
    replyTimer.current = setTimeout(() => {
      setTyping(false);
      riderReply();
    }, 1700);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="close" accessibilityLabel="ปิด" onPress={() => router.back()} />
        <View style={styles.headerCenter}>
          <View style={styles.headerNameRow}>
            <Text variant="subtitle" numberOfLines={1} style={styles.headerName}>
              {rider.name.split(' ')[0]}
            </Text>
            <Ionicons name="shield-checkmark" size={15} color={Colors.primaryStrong} />
          </View>
          <Text variant="caption" style={styles.headerRole}>
            ไรเดอร์อู้ฟู่
          </Text>
        </View>
        <IconButton
          icon="call"
          accessibilityLabel="โทรหาไรเดอร์"
          onPress={() => Linking.openURL(`tel:${rider.phone}`).catch(() => {})}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 8}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {messages.map((m, i) => {
            const mine = m.from === 'me';
            return (
              <Animated.View
                key={m.id}
                entering={FadeInDown.delay(Math.min(i, 6) * 45).springify().damping(16)}
                style={[styles.bubbleWrap, mine ? styles.wrapMine : styles.wrapTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={mine ? styles.textMine : styles.textTheirs}>{m.text}</Text>
                </View>
                <Text variant="caption" style={styles.time}>
                  {m.time}
                </Text>
              </Animated.View>
            );
          })}

          {typing ? (
            <Animated.View entering={FadeIn.duration(180)} style={styles.typingWrap}>
              <TypingDots />
            </Animated.View>
          ) : null}
        </ScrollView>

        {/* Composer */}
        <View style={[styles.composer, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="พิมพ์ข้อความ..."
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={onSend}
          />
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="ส่งข้อความ"
            disabled={!hasDraft}
            onPress={onSend}
            style={[styles.sendBtn, sendStyle]}>
            <Ionicons name="send" size={18} color={Colors.textOnPrimary} />
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  headerName: {
    textAlign: 'center',
    color: Colors.text,
  },
  headerRole: {
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  bubbleWrap: {
    maxWidth: '82%',
  },
  wrapMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  wrapTheirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  bubbleMine: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: Radius.sm,
  },
  bubbleTheirs: {
    backgroundColor: Colors.surfaceMuted,
    borderBottomLeftRadius: Radius.sm,
  },
  textMine: {
    ...Typography.body,
    color: Colors.textOnPrimary,
  },
  textTheirs: {
    ...Typography.body,
    color: Colors.text,
  },
  time: {
    marginTop: Spacing.xxs,
    marginHorizontal: Spacing.xs,
  },
  typingWrap: {
    alignSelf: 'flex-start',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  input: {
    ...Typography.body,
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
    color: Colors.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
