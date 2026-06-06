import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!envUrl || !anonKey) {
  throw new Error(
    'Supabase env vars missing. Copy .env.example to .env.local and fill in the values from `supabase status`.',
  );
}

/**
 * Resolve the Supabase URL. In dev, the configured URL points at a LAN IP that
 * goes stale whenever the machine changes network (hotspot → WiFi, etc.), which
 * breaks the app on physical devices. Since local Supabase runs on the same
 * machine as the Metro dev server, we derive the host from whatever host the
 * app actually loaded Metro from — so it always matches the current network on
 * any device, with no manual .env edits. Only applies to local/LAN http URLs;
 * a remote https URL (real Supabase) is used verbatim.
 */
function resolveSupabaseUrl(configured: string): string {
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(
    configured,
  );
  if (!isLocal) return configured;

  const hostUri =
    Constants.expoConfig?.hostUri ??
    // older runtimes expose the dev host here instead
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost;
  const devHost = hostUri?.split(':')[0];
  if (!devHost) return configured;

  const port = configured.split(':')[2] ?? '54321';
  return `http://${devHost}:${port}`;
}

export const supabaseUrl = resolveSupabaseUrl(envUrl);
export const supabase = createClient(supabaseUrl, anonKey);
