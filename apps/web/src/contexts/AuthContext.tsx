'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, type Session, type User, type SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  configError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => string | null;
  supabase: SupabaseClient | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(
    hasSupabaseConfig ? null : "Missing Supabase environment variables"
  );
  const router = useRouter();

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        // Sync with backend on sign in (non-blocking, skip if backend unavailable)
        if (event === 'SIGNED_IN' && session) {
          syncWithBackend(session).catch(() => {
            // Silently ignore - backend may not be running
          });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const syncWithBackend = async (session: Session) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const jwt = session.access_token;

    try {
      const response = await fetch(`${apiUrl}/api/auth/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          google_access_token: session.provider_token,
          google_refresh_token: session.provider_refresh_token,
          display_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
        }),
      });

      if (!response.ok) {
        console.warn('[Auth] Backend sync failed:', response.status);
      }
    } catch {
      // Expected when API server is not running during development
      console.warn('[Auth] Could not reach API server for sync — is the API running?');
    }
  };

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      setConfigError('Cannot sign in: Supabase env vars missing');
      return;
    }

    const redirectUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/` 
      : 'http://localhost:3000/';

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        scopes: [
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/calendar.readonly',
        ].join(' '),
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    router.push('/');
  }, [router]);

  const getAccessToken = useCallback(() => {
    return session?.access_token ?? null;
  }, [session]);

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    configError,
    signInWithGoogle,
    signOut,
    getAccessToken,
    supabase,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
