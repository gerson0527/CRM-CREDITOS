'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Profile } from '@/lib/types';

interface AuthContextValue {
  session: { access_token: string } | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    console.log('[FRONT AuthProvider] loadProfile ▶');
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      console.log('[FRONT AuthProvider] /me status:', res.status);
      const data = await res.json();
      console.log('[FRONT AuthProvider] /me data:', data);
      if (data.user) {
        console.log('[FRONT AuthProvider] ✓ user loaded:', { id: data.user.id, role: data.user.role });
        setProfile(data.user as Profile);
        setSession({ access_token: 'cookie' });
      } else {
        console.log('[FRONT AuthProvider] ✕ no user in response');
        setProfile(null);
        setSession(null);
      }
    } catch (err) {
      console.error('[FRONT AuthProvider] ✕ error loading profile:', err);
      setProfile(null);
      setSession(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    console.log('[FRONT AuthProvider] refreshProfile ▶');
    await loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    console.log('[FRONT AuthProvider] useEffect ▶ mount, calling loadProfile');
    let mounted = true;
    loadProfile().finally(() => {
      if (mounted) {
        console.log('[FRONT AuthProvider] useEffect ▶ setting loading=false');
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setSession(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}