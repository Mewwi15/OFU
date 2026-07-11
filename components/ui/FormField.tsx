import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

export type FormFieldProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences';
  /** Read-only display (e.g. the login phone number). */
  readOnly?: boolean;
  hint?: string;
  /** Error takes the hint slot in the danger colour. */
  error?: string;
  maxLength?: number;
  /** Password entry — masked with a show/hide eye toggle. */
  secure?: boolean;
};

/** Labelled input row (icon + field + hint/error) used by the account forms. */
export function FormField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  readOnly = false,
  hint,
  error,
  maxLength,
  secure = false,
}: FormFieldProps) {
  const [hidden, setHidden] = useState(secure);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputRow, readOnly && styles.inputRowReadonly]}>
        <Ionicons name={icon} size={18} color={Colors.textMuted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={!readOnly}
          maxLength={maxLength}
          secureTextEntry={hidden}
          style={[styles.input, readOnly && styles.inputReadonly]}
        />
        {secure ? (
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'แสดงรหัสผ่าน' : 'ซ่อนรหัสผ่าน'}
            onPress={() => setHidden((v) => !v)}>
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={Colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.fieldHint, styles.fieldError]}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.sm,
  },
  fieldLabel: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    ...Typography.body,
    flex: 1,
    color: Colors.text,
    padding: 0,
  },
  inputRowReadonly: {
    backgroundColor: Colors.surfaceMuted,
    borderColor: 'transparent',
  },
  inputReadonly: {
    color: Colors.textMuted,
  },
  fieldHint: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  fieldError: {
    color: Colors.dangerStrong,
  },
});
