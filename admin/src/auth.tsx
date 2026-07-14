import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { clearFlightLog } from './lib/flightRecorder';
import { supabase } from './lib/supabase';

export type AdminProfile = {
  id: string;
  displayName: string;
  role: string;
  tier: string | null;
};

type AuthCtx = {
  ready: boolean;
  session: Session | null;
  profile: AdminProfile | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
// eslint-disable-next-line react/only-export-components -- hook + provider are one module by design
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);

  async function loadProfile(s: Session | null) {
    if (!s) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from('app_users')
      .select('id, display_name, role, admin_tier')
      .eq('id', s.user.id)
      .maybeSingle();
    setProfile(
      data
        ? { id: data.id, displayName: data.display_name ?? '', role: data.role, tier: data.admin_tier }
        : null,
    );
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setReady(true);
    });
    // Don't await supabase calls inside the callback (auth-lock deadlock) — defer.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => {
        void loadProfile(s);
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // Wipe the scanner-debug tape so the next cashier on a shared till can't
    // read the previous one's session in /scan-lab. The offline sale queues
    // (pos.queue.v1 / .failed.v1) are left alone on purpose — they're
    // unsynced or failed real transactions that must survive a cashier
    // switch, or the till would silently lose money on logout.
    clearFlightLog();
  };

  return (
    <Ctx.Provider
      value={{ ready, session, profile, isAdmin: profile?.role === 'admin', signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}
