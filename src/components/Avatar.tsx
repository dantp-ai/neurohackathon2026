import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/theme';

type AvatarProps = {
  name: string;
  uri?: string | null;
  size?: number;
};

/** Round avatar: shows a photo if available, otherwise the person's initials. */
export function Avatar({ name, uri, size = 48 }: AvatarProps) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={[styles.img, dim]} contentFit="cover" />;
  }
  return (
    <View style={[styles.fallback, dim]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials(name)}</Text>
    </View>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

const styles = StyleSheet.create({
  img: { backgroundColor: colors.surfaceAlt },
  fallback: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { ...typography.bodyStrong, color: colors.textInverse },
});

export default Avatar;
