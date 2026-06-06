import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MessageThread } from '@/components';
import { CURRENT_CAREGIVER, CURRENT_PATIENT } from '@/mock/data';
import { colors, spacing, typography } from '@/theme';

/** Patient's conversation with their caregiver. */
export default function PatientMessages() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('tabs.messages')}</Text>
        <Text style={styles.subtitle}>{t('messages.with', { name: CURRENT_CAREGIVER.display_name })}</Text>
      </View>
      <MessageThread
        patientName={CURRENT_PATIENT.user.display_name}
        caregiverName={CURRENT_CAREGIVER.display_name}
        senderRole="patient"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
