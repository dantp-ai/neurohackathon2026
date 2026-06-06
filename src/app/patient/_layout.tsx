import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

/** Emoji tab icon — no icon-font dependency, legible and friendly. */
const TabIcon = (glyph: string) => {
  const Icon = ({ focused }: { focused: boolean }) => (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>
  );
  Icon.displayName = `TabIcon(${glyph})`;
  return Icon;
};

/**
 * Patient bottom-tab navigation. Guards the area: if the current session is
 * not a patient, bounce back to the role switcher.
 */
export default function PatientLayout() {
  const { t } = useTranslation();
  const { role } = useSession();
  if (role !== 'patient') {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { height: 64, paddingBottom: spacing.sm, paddingTop: spacing.sm },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: TabIcon('🏠') }} />
      <Tabs.Screen
        name="medication"
        options={{ title: t('tabs.medicine'), tabBarIcon: TabIcon('💊') }}
      />
      <Tabs.Screen name="messages" options={{ title: t('tabs.messages'), tabBarIcon: TabIcon('💬') }} />
    </Tabs>
  );
}
