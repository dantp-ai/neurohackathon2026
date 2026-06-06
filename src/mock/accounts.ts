/**
 * Seeded demo accounts that back the login screen.
 *
 * This stands in for Supabase Auth: same idea (email + password -> a user with
 * a role), but resolved locally so the demo never depends on a network call or
 * email confirmation. When real auth lands, replace `findAccount` with a
 * Supabase `signInWithPassword` call and drop this file.
 */

import { User } from '@/types';
import { CURRENT_CAREGIVER, CURRENT_PATIENT } from './data';

export interface DemoAccount {
  email: string;
  password: string;
  user: User;
  /** Short label for the one-tap demo login buttons. */
  label: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'margaret@demo.com',
    password: 'demo1234',
    user: CURRENT_PATIENT.user,
    label: `${CURRENT_PATIENT.user.display_name} · Patient`,
  },
  {
    email: 'mei@demo.com',
    password: 'demo1234',
    user: CURRENT_CAREGIVER,
    label: `${CURRENT_CAREGIVER.display_name} · Caregiver`,
  },
];

/** Look up a seeded account by credentials (case-insensitive email). */
export function findAccount(email: string, password: string): DemoAccount | undefined {
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === normalized && a.password === password,
  );
}
