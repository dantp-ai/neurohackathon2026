import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'md' | 'lg' | 'xl';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  /** Optional leading element (e.g. an emoji or icon). */
  leading?: ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
};

/**
 * App button. `size="xl"` is intended for the patient check-in screen, where
 * tap targets must be large and unambiguous.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leading,
  fullWidth = true,
  style,
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border },
        s.container,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.label, s.label, { color: v.fg }]} numberOfLines={1}>
          {leading ? `${typeof leading === 'string' ? leading + '  ' : ''}` : ''}
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const variantStyles: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.textInverse, border: colors.primary },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
  danger: { bg: colors.statusBad, fg: colors.textInverse, border: colors.statusBad },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
};

const sizeStyles: Record<Size, { container: ViewStyle; label: { fontSize: number } }> = {
  md: { container: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg }, label: { fontSize: 16 } },
  lg: { container: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl }, label: { fontSize: 18 } },
  xl: { container: { paddingVertical: spacing.xl, paddingHorizontal: spacing.xl }, label: { fontSize: 22 } },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  label: { ...typography.bodyStrong, textAlign: 'center' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});

export default Button;
