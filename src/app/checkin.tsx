import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen } from '@/components';
import { CheckinResponseValue } from '@/types';
import { colors, radius, spacing, statusColors, StatusLevel, typography } from '@/theme';

interface Choice {
  value: CheckinResponseValue;
  emoji: string;
  label: string;
  level: StatusLevel;
}

const CHOICES: Choice[] = [
  { value: 'ok', emoji: '✅', label: "I'm okay", level: 'good' },
  { value: 'not_great', emoji: '😐', label: 'Not great', level: 'warn' },
  { value: 'help', emoji: '🆘', label: 'I need help', level: 'bad' },
];

/**
 * Full-screen check-in, opened on an anomaly alert. Three large, unambiguous
 * buttons. Submitting (mock) would write a `checkin_responses` row and dismiss.
 */
export default function CheckinModal() {
  const router = useRouter();
  const [selected, setSelected] = useState<CheckinResponseValue | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    // TODO(backend): write checkin_responses row to Supabase here.
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>💙</Text>
          <Text style={styles.thanksTitle}>Thank you</Text>
          <Text style={styles.thanksBody}>
            Your care team has been updated.
            {selected === 'help' ? ' Someone will reach out to you shortly.' : ''}
          </Text>
          <Button title="Done" size="lg" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>We noticed something</Text>
        <Text style={styles.subtitle}>How are you feeling right now?</Text>
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
                { backgroundColor: isSel ? tint.bg : colors.surface, borderColor: isSel ? tint.fg : colors.border },
              ]}
            >
              <Text style={styles.choiceEmoji}>{c.emoji}</Text>
              <Text style={[styles.choiceLabel, isSel && { color: tint.fg }]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.voiceCard}>
        <Text style={styles.voiceLabel}>🎙️  Add a voice note (optional)</Text>
        <Text style={styles.voiceNote}>Coming soon — recording will attach to this check-in.</Text>
      </Card>

      <View style={styles.footer}>
        <Button title="Submit" size="xl" disabled={!selected} onPress={submit} />
        <Button title="Not now" variant="ghost" onPress={() => router.back()} />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  choiceEmoji: { fontSize: 36 },
  choiceLabel: { ...typography.heading, color: colors.text },
  voiceCard: { marginTop: spacing.xl, gap: spacing.xs },
  voiceLabel: { ...typography.bodyStrong, color: colors.text },
  voiceNote: { ...typography.caption, color: colors.textMuted },
  footer: { marginTop: spacing.xxl, gap: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  bigEmoji: { fontSize: 64 },
  thanksTitle: { ...typography.title, color: colors.text },
  thanksBody: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },
});
