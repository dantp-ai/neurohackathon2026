import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!envUrl || !anonKey) {
  throw new Error(
    'Supabase env vars missing. Copy .env.example to .env.local and fill in the values from `supabase status`.',
  );
}

/**
 * Resolve the Supabase URL. In dev, the configured URL points at a LAN IP that
 * goes stale whenever the machine changes network — which breaks the app. Since
 * local Supabase runs on the same machine as the app's host, we derive the host
 * at runtime so it always matches the current network, no manual .env edits:
 *   • web    → the browser's own host (window.location.hostname) — always the
 *              dev machine, reachable regardless of LAN IP.
 *   • native → the Metro dev-server host the app actually connected to.
 * Only applies to local/LAN http URLs; a remote https URL is used verbatim.
 */
function resolveSupabaseUrl(configured: string): string {
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(
    configured,
  );
  if (!isLocal) return configured;
  const port = configured.split(':')[2] ?? '54321';

  if (Platform.OS === 'web') {
    const host =
      (typeof window !== 'undefined' && window.location?.hostname) || 'localhost';
    return `http://${host}:${port}`;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost;
  const devHost = hostUri?.split(':')[0];
  return devHost ? `http://${devHost}:${port}` : configured;
}

export const supabaseUrl = resolveSupabaseUrl(envUrl);
export const supabase = createClient(supabaseUrl, anonKey);
