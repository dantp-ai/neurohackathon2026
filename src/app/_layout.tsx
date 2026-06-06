import '../i18n'; // initialize i18n before any screen renders

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/store/session';
import { colors } from '@/theme';

/**
 * Root layout: global providers + the top-level navigation stack.
 *
 * GestureHandlerRootView must wrap the whole app or gestures (used by the Skia
 * embedding graph) silently no-op. The two role areas (`patient`, `caregiver`)
 * are nested navigators; `demo` is the standalone streaming-embedding showcase;
 * `checkin` is a full-screen modal.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
            <Stack.Screen name="demo" />
            <Stack.Screen
              name="checkin"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
          </Stack>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
