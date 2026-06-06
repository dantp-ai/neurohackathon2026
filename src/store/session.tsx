/**
 * Session state: who is signed in and in which role.
 *
 * For now this is backed by seeded demo accounts (see `@/mock/accounts`) so the
 * demo never depends on a network call. When Supabase Auth is wired up, replace
 * the body of `signInWithEmail` with `supabase.auth.signInWithPassword(...)` and
 * read the user's `role` from the `users` table — consuming screens (which only
 * read `useSession()`) won't need to change.
 */

import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

import { findAccount } from '@/mock/accounts';
import { CURRENT_CAREGIVER, CURRENT_PATIENT } from '@/mock/data';
import { Role, User } from '@/types';

interface SignInResult {
  ok: boolean;
  role?: Role;
  error?: string;
}

interface SessionState {
  role: Role | null;
  user: User | null;
  /** Authenticate against the seeded demo accounts. */
  signInWithEmail: (email: string, password: string) => SignInResult;
  /** Dev shortcut: jump straight into a role with its mock user. */
  signInAs: (role: Role) => Role;
  signOut: () => void;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const value = useMemo<SessionState>(
    () => ({
      role,
      user,
      signInWithEmail: (email, password) => {
        const account = findAccount(email, password);
        if (!account) {
          return { ok: false, error: 'Incorrect email or password.' };
        }
        setUser(account.user);
        setRole(account.user.role);
        return { ok: true, role: account.user.role };
      },
      signInAs: (nextRole) => {
        setRole(nextRole);
        setUser(nextRole === 'patient' ? CURRENT_PATIENT.user : CURRENT_CAREGIVER);
        return nextRole;
      },
      signOut: () => {
        setRole(null);
        setUser(null);
      },
    }),
    [role, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a <SessionProvider>');
  }
  return ctx;
}
