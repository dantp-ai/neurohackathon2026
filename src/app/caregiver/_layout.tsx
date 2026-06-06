import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/store/session';
import { colors } from '@/theme';

/**
 * Caregiver area is a stack: the patient list pushes the patient detail screen.
 * The Metrics / Alerts / Messages / Labels "tabs" live *inside* the detail
 * screen, so they are not top-level navigation here.
 */
export default function CaregiverLayout() {
  const { role } = useSession();
  if (role !== 'caregiver') {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="patient/[id]" />
    </Stack>
  );
}
