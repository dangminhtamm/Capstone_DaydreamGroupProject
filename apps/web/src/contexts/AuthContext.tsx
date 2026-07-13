'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, type Session, type User, type SupabaseClient } from '@supabase/supabase-js';
import { getAuthCallbackUrl, syncSessionWithBackend } from '@/lib/auth-flow';

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
  signInWithGoogle: () => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<{ error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
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
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.warn('[Auth] Session restore failed:', error.message);
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        setSession(null);
        setUser(null);
        setIsLoading(false);
        return;
      }

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
          syncSessionWithBackend(session).catch(() => {
            // Silently ignore - backend may not be running
          });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<{ error?: string }> => {
    if (!supabase) {
      setConfigError('Cannot sign in: Supabase env vars missing');
      return { error: 'Cannot sign in: Supabase env vars missing' };
    }

    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthCallbackUrl(),
      },
    });

    if (error) {
      return { error: error.message };
    }

    return {};
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, displayName: string): Promise<{ error?: string }> => {
    if (!supabase) return { error: 'Supabase not configured' };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
        data: {
          full_name: displayName,
        },
      },
    });

    if (error) return { error: error.message };

    // Supabase returns a user with empty identities when the email already exists
    // (and email confirmation is enabled). Detect this case.
    if (data?.user?.identities?.length === 0) {
      return { error: 'An account with this email already exists. Try signing in or use Google login.' };
    }

    return {};
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    if (!supabase) return { error: 'Supabase not configured' };

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return { error: error.message };
    router.push('/diary');
    return {};
  }, [router]);

  const resetPassword = useCallback(async (email: string): Promise<{ error?: string }> => {
    if (!supabase) return { error: 'Supabase not configured' };

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthCallbackUrl('recovery'),
    });

    if (error) return { error: error.message };
    return {};
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
    signUpWithEmail,
    signInWithEmail,
    resetPassword,
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
