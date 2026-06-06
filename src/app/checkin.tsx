import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Screen, TextField } from '@/components';
import { CheckinResponseValue } from '@/types';
import { colors, radius, spacing, statusColors, StatusLevel, typography } from '@/theme';

interface Choice {
  value: CheckinResponseValue;
  labelKey: string;
  level: StatusLevel;
}

const CHOICES: Choice[] = [
  { value: 'ok', labelKey: 'feelings.okay', level: 'good' },
  { value: 'not_great', labelKey: 'feelings.notGreat', level: 'warn' },
  { value: 'help', labelKey: 'feelings.needHelp', level: 'bad' },
];

/**
 * Check-in screen (also opened from an anomaly ping). A calm "how are you
 * feeling" with a free-text field. No emojis.
 */
export default function CheckinModal() {
  const router = useRouter();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<CheckinResponseValue | null>(null);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    // TODO(backend): write checkin_responses row.
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.thanksTitle}>{t('checkin.thankYou')}</Text>
          <Text style={styles.thanksBody}>
            {t('checkin.updatedBody')}
            {selected === 'help' ? ` ${t('checkin.reachOut')}` : ''}
          </Text>
          <Button title={t('common.done')} size="lg" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{t('checkin.howFeeling')}</Text>
        <Text style={styles.subtitle}>{t('checkin.subtitle')}</Text>
      </View>

      <View style={styles.choices}>
        {CHOICES.map((c) => {
          const isSel = selected === c.value;
          const tint = statusColors[c.level];
          return (
            <Pressable
              key={c.value}
              onPress={() => setSelected(c.value)}
              style={[
                styles.choice,
                {
                  backgroundColor: isSel ? tint.bg : colors.surface,
                  borderColor: isSel ? tint.fg : colors.border,
                },
              ]}
            >
              <Text style={[styles.choiceLabel, isSel && { color: tint.fg }]}>{t(c.labelKey)}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextField
        label={t('patient.describe')}
        value={note}
        onChangeText={setNote}
        placeholder={t('patient.describePlaceholder')}
        multiline
        style={styles.noteInput}
      />

      <View style={styles.footer}>
        <Button title={t('common.submit')} size="xl" disabled={!selected && !note.trim()} onPress={submit} />
        <Button title={t('common.notNow')} variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.lg, marginBottom: spacing.xl },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  choices: { gap: spacing.md },
  choice: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 2,
    alignItems: 'center',
  },
  choiceLabel: { ...typography.heading, color: colors.text },
  noteInput: { minHeight: 80, textAlignVertical: 'top', marginTop: spacing.xl },
  footer: { marginTop: spacing.xxl, gap: spacing.sm },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  thanksTitle: { ...typography.title, color: colors.text },
  thanksBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
