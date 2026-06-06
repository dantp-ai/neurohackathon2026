import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Supabase env vars missing. Copy .env.example to .env.local and fill in the values from `supabase status`.',
  );
}

export const supabase = createClient(url, anonKey);
