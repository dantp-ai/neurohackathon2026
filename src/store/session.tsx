/**
 * Session state: who is "logged in" and in which role.
 *
 * For now this is a mock, switched manually from the dev entry screen so the
 * team can preview both the patient and caregiver experiences. When Supabase
 * Auth is wired up, replace the body of `SessionProvider` with the real auth
 * session + the user's `role` from the `users` table — the consuming screens
 * (which only read `useSession()`) won't need to change.
 */

import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

import { CURRENT_CAREGIVER, CURRENT_PATIENT } from '@/mock/data';
import { Role, User } from '@/types';

interface SessionState {
  role: Role | null;
  user: User | null;
  /** Dev helper: jump into a role with the matching mock user. */
  signInAs: (role: Role) => void;
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
      signInAs: (nextRole) => {
        setRole(nextRole);
        setUser(nextRole === 'patient' ? CURRENT_PATIENT.user : CURRENT_CAREGIVER);
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
