import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';

import { toggleLanguage } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

/** Small pill that switches the app between English and Simplified Chinese. */
export function LanguageToggle() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh-Hans';
  return (
    <Pressable onPress={toggleLanguage} style={styles.pill} hitSlop={8} accessibilityRole="button">
      <Text style={styles.text}>{isZh ? 'EN' : '中文'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  text: { ...typography.label, color: colors.text },
});

export default LanguageToggle;
