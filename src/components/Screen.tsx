import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type ScreenProps = {
  children: ReactNode;
  /** Wrap content in a vertical ScrollView. Defaults to true. */
  scroll?: boolean;
  /** Apply default horizontal+vertical padding. Defaults to true. */
  padded?: boolean;
  /** Which safe-area edges to inset. Defaults to top + bottom. */
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: ViewStyle;
};

/**
 * Standard screen wrapper: safe-area insets, app background, and optional
 * scroll + padding. Use this as the outermost element of every screen so
 * spacing and background stay consistent across the app.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ['top', 'bottom'],
  style,
}: ScreenProps) {
  const inner = (
    <View style={[padded && styles.padded, !scroll && styles.flex, style]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
});

export default Screen;
