import { ReactNode } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

type CardProps = {
  children: ReactNode;
  /** When provided, the whole card becomes tappable. */
  onPress?: () => void;
  style?: ViewStyle;
};

/** A white rounded surface with subtle elevation. The base building block. */
export function Card({ children, onPress, style }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    // soft shadow (iOS) + elevation (Android)
    shadowColor: '#0B1B2B',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pressed: { opacity: 0.85 },
});

export default Card;
