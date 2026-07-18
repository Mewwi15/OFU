/**
 * Shop chat — `/chat`.
 *
 * The customer's single ongoing conversation with the shop (LINE-OA style).
 * Real backend: history + Realtime via store/chat, text and photo messages.
 * Customer bubbles are coral and right-aligned; shop replies are muted and
 * left-aligned. Header carries the shop name + a help action. Tokens-only,
 * zero emoji.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { compressForUpload } from '@/lib/images';
import { useChat } from '@/store/chat';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ShopChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  const messages = useChat((s) => s.messages);
  const loading = useChat((s) => s.loading);
  const sending = useChat((s) => s.sending);
  const open = useChat((s) => s.open);
  const close = useChat((s) => s.close);
  const send = useChat((s) => s.send);
  const sendImage = useChat((s) => s.sendImage);

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    open().catch(() => Alert.alert(t('chat.loadFailed')));
    return close;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasDraft = draft.trim().length > 0;

  // Animate the send button between idle (small, faded) and ready (full).
  const sendProgress = useSharedValue(0);
  useEffect(() => {
    sendProgress.value = withSpring(hasDraft && !sending ? 1 : 0, {
      damping: 14,
      stiffness: 220,
    });
  }, [hasDraft, sending, sendProgress]);
  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.85 + sendProgress.value * 0.15 }],
    opacity: 0.4 + sendProgress.value * 0.6,
  }));

  const onSend = () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    send(text).catch(() => {
      setDraft(text); // give the message back rather than losing it
      Alert.alert(t('chat.sendFailed'));
    });
  };

  const onAttach = async () => {
    // OS photo picker — no media-library permission needed.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
    if (result.canceled) return;
    try {
      const img = await compressForUpload(result.assets[0]);
      await sendImage(img.base64);
    } catch {
      Alert.alert(t('chat.sendFailed'));
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="close" accessibilityLabel={t('ui.close')} onPress={() => router.back()} />
        <View style={styles.headerCenter}>
          <View style={styles.headerNameRow}>
            <Text variant="subtitle" numberOfLines={1} style={styles.headerName}>
              {t('chat.title')}
            </Text>
            <Ionicons name="shield-checkmark" size={15} color={Colors.primaryStrong} />
          </View>
          <Text variant="caption" style={styles.headerRole}>
            {t('chat.role')}
          </Text>
        </View>
        <IconButton
          icon="information-circle-outline"
          accessibilityLabel={t('track.helpTitle')}
          onPress={() => Alert.alert(t('track.helpTitle'), t('track.helpBody'))}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 8}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, !messages.length && styles.listEmpty]}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {!messages.length && !loading ? (
            <View style={styles.empty}>
              <View style={styles.emptyBadge}>
                <Ionicons name="chatbubbles-outline" size={32} color={Colors.primaryStrong} />
              </View>
              <Text variant="body" style={styles.emptyText}>
                {t('chat.empty')}
              </Text>
            </View>
          ) : null}

          {messages.map((m, i) => (
            <Animated.View
              key={m.id}
              entering={FadeInDown.delay(Math.min(i, 6) * 45).springify().damping(16)}
              style={[styles.bubbleWrap, m.mine ? styles.wrapMine : styles.wrapTheirs]}>
              {m.imageUrl ? (
                <Image
                  source={{ uri: m.imageUrl }}
                  style={styles.imageBubble}
                  contentFit="cover"
                  transition={200}
                  accessibilityLabel={t('chat.imageLabel')}
                />
              ) : (
                <View style={[styles.bubble, m.mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={m.mine ? styles.textMine : styles.textTheirs}>{m.text}</Text>
                </View>
              )}
              <Text variant="caption" style={styles.time}>
                {m.time}
              </Text>
            </Animated.View>
          ))}
        </ScrollView>

        {/* Composer */}
        <View style={[styles.composer, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('chat.attachA11y')}
            disabled={sending}
            onPress={() => void onAttach()}
            style={styles.attachBtn}>
            <Ionicons name="image-outline" size={22} color={Colors.primaryStrong} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('track.messagePlaceholder')}
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={onSend}
          />
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel={t('track.sendMessageA11y')}
            disabled={!hasDraft || sending}
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
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.x2,
  },
  emptyBadge: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textMuted,
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
  imageBubble: {
    width: 220,
    height: 220,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceMuted,
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
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
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
