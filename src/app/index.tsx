import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, Card, Screen, TextField } from '@/components';
import { DEMO_ACCOUNTS, DemoAccount } from '@/mock/accounts';
import { useSession } from '@/store/session';
import { Role } from '@/types';
import { colors, spacing, typography } from '@/theme';

/**
 * Login screen. Backed by seeded demo accounts (see `@/mock/accounts`); looks
 * and behaves like real auth so it demos cleanly, without a backend dependency.
 * Swap `signInWithEmail` for Supabase Auth later without touching this screen.
 */
export default function Login() {
  const router = useRouter();
  const { signInWithEmail } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();

  const routeFor = (role: Role) => (role === 'patient' ? '/patient' : '/caregiver');

  const submit = () => {
    const result = signInWithEmail(email, password);
    if (!result.ok || !result.role) {
      setError(result.error ?? 'Sign in failed.');
      return;
    }
    setError(undefined);
    router.replace(routeFor(result.role));
  };

  const quickLogin = (account: DemoAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    setError(undefined);
    const result = signInWithEmail(account.email, account.password);
    if (result.ok && result.role) {
      router.replace(routeFor(result.role));
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.brand}>NeuroMonitor</Text>
          <Text style={styles.tagline}>EEG wellbeing monitoring for care teams</Text>
        </View>

        <Card style={styles.card}>
          <TextField
            label="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (error) setError(undefined);
            }}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (error) setError(undefined);
            }}
            placeholder="••••••••"
            secureTextEntry
            textContentType="password"
            error={error}
            onSubmitEditing={submit}
            returnKeyType="go"
          />
          <Button title="Sign in" size="lg" onPress={submit} style={styles.signIn} />
        </Card>

        <View style={styles.demoSection}>
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>Demo accounts</Text>
            <View style={styles.divider} />
          </View>
          {DEMO_ACCOUNTS.map((account) => (
            <Pressable
              key={account.email}
              style={styles.demoBtn}
              onPress={() => quickLogin(account)}
            >
              <Text style={styles.demoLabel}>{account.label}</Text>
              <Text style={styles.demoArrow}>›</Text>
            </Pressable>
          ))}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxxl, marginBottom: spacing.xl, alignItems: 'center' },
  brand: { ...typography.display, color: colors.primary },
  tagline: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  card: { gap: spacing.lg },
  signIn: { marginTop: spacing.sm },
  demoSection: { marginTop: spacing.xl, gap: spacing.md },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { ...typography.caption, color: colors.textMuted },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  demoLabel: { ...typography.bodyStrong, color: colors.text },
  demoArrow: { ...typography.heading, color: colors.textMuted },
});
