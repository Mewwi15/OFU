import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Colors, PoppinsFonts, Radius, Shadow, Spacing } from '@/constants/theme';

export type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  /** Placeholder text. Defaults to "Search". */
  placeholder?: string;
  /** Show + handle the trailing sliders/filter icon. */
  onFilterPress?: () => void;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * White rounded search field: leading magnifier icon, text input, and an
 * optional trailing filter icon.
 */
export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
  onFilterPress,
  autoFocus,
  style,
}: SearchBarProps) {
  return (
    <View style={[styles.container, style]}>
      <Ionicons
        name="search"
        size={18}
        color={Colors.textMuted}
        style={styles.leadingIcon}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        autoFocus={autoFocus}
        returnKeyType="search"
        style={styles.input}
      />
      {onFilterPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter"
          onPress={onFilterPress}
          hitSlop={8}
          style={({ pressed }) => [styles.filter, pressed && styles.pressed]}>
          <Ionicons name="options-outline" size={18} color={Colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    ...Shadow.card,
  },
  leadingIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: PoppinsFonts.regular,
    fontSize: 14,
    color: Colors.text,
    padding: 0,
  },
  filter: {
    marginLeft: Spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
});
