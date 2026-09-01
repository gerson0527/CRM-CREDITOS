'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile } from '@/lib/types';
import { ChangePasswordDialog } from '@/components/change-password-dialog';

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
  const router = useRouter();

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (data.user) {
        setProfile(data.user as Profile);
        setSession({ access_token: 'cookie' });
      } else {
        setProfile(null);
        setSession(null);
      }
    } catch (err) {
      setProfile(null);
      setSession(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    let mounted = true;
    loadProfile().finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setSession(null);
    setProfile(null);
    router.push('/login');
  }, [router]);

  const mustChangePassword = !!profile?.must_change_password;
  const showPasswordDialog = !!session && !loading && mustChangePassword;

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut, refreshProfile }}>
      {children}
      <ChangePasswordDialog
        open={showPasswordDialog}
        onSuccess={() => {
          // El backend ya puso must_change_password=false; el siguiente refreshProfile ya no la mostrará
        }}
        onLogout={() => {
          signOut();
        }}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}