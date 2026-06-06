import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/store/session';
import { colors } from '@/theme';

/**
 * Root layout: global providers + the top-level navigation stack.
 *
 * The two role areas (`patient`, `caregiver`) are nested navigators registered
 * here. `checkin` is presented as a full-screen modal because it is triggered
 * by a push notification on top of whatever screen the patient is on.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="patient" />
          <Stack.Screen name="caregiver" />
          <Stack.Screen
            name="checkin"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
