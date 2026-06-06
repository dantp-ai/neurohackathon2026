import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen } from '@/components';
import { useSession } from '@/store/session';
import { Role } from '@/types';
import { colors, spacing, typography } from '@/theme';

/**
 * Dev entry / role switcher.
 *
 * Stands in for the real Supabase login. Lets any teammate jump straight into
 * either role to preview that experience. Once auth lands, this screen becomes
 * the login form and routing is driven by the user's stored `role`.
 */
export default function RoleSwitcher() {
  const router = useRouter();
  const { signInAs } = useSession();

  const enter = (role: Role) => {
    signInAs(role);
    router.replace(role === 'patient' ? '/patient' : '/caregiver');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.brand}>NeuroMonitor</Text>
        <Text style={styles.tagline}>EEG wellbeing monitoring for care teams</Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.prompt}>Choose a view to preview</Text>
        <Text style={styles.note}>
          Dev mode — this stands in for login. Pick the role you want to work on.
        </Text>
        <View style={styles.actions}>
          <Button title="Enter as Patient" size="lg" onPress={() => enter('patient')} />
          <Button
            title="Enter as Caregiver"
            size="lg"
            variant="secondary"
            onPress={() => enter('caregiver')}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxl, marginBottom: spacing.xl, alignItems: 'center' },
  brand: { ...typography.display, color: colors.primary },
  tagline: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  card: { gap: spacing.md },
  prompt: { ...typography.heading, color: colors.text },
  note: { ...typography.caption, color: colors.textMuted },
  actions: { gap: spacing.md, marginTop: spacing.md },
});
