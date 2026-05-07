'use client';
import { useEffect, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';

// Initialize the Supabase Client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function GoogleAuthButton() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<string>('');
    const [userEmail, setUserEmail] = useState<string | null>(null);

    const hasSupabaseConfig = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const configError = hasSupabaseConfig
        ? null
        : '❌ Missing Supabase env (`NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)';

    async function syncWithBackend(session: Session) {
        setIsSyncing(true);
        setSyncStatus('Syncing with backend...');

        const jwt = session.access_token;
        const googleAccessToken = session.provider_token;
        const googleRefreshToken = session.provider_refresh_token;
        const displayName =
            (session.user.user_metadata?.full_name as string | undefined) ??
            (session.user.user_metadata?.name as string | undefined);

        if (!jwt) {
            setSyncStatus('❌ Missing JWT from session');
            setIsSyncing(false);
            return;
        }

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

            const response = await fetch(`${apiUrl}/auth/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
                body: JSON.stringify({
                    google_access_token: googleAccessToken,
                    google_refresh_token: googleRefreshToken,
                    display_name: displayName,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    `Backend sync failed: HTTP ${response.status} - ${errorData.message || 'Unknown error'}`
                );
            }

            setSyncStatus('✅ Login + sync thành công');
        } catch (error) {
            console.error('Error syncing user:', error);
            setSyncStatus('❌ Sync backend thất bại. Kiểm tra API URL hoặc token.');
        } finally {
            setIsSyncing(false);
        }
    }

    useEffect(() => {
        if (!hasSupabaseConfig) {
            return;
        }

        supabase.auth.getSession().then(({ data }) => {
            setUserEmail(data.session?.user?.email ?? null);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                setUserEmail(session.user.email ?? null);
                await syncWithBackend(session);
            }

            if (event === 'SIGNED_OUT') {
                setUserEmail(null);
                setSyncStatus('Đã đăng xuất');
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [hasSupabaseConfig]);

    const handleLogin = async () => {
        if (!hasSupabaseConfig) {
            return;
        }

        setIsLoading(true);
        setSyncStatus('');
        
        try {
            await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                    scopes: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.readonly',
                },
            });
        } catch (error) {
            console.error("OAuth Error:", error);
            setIsLoading(false);
            setSyncStatus('❌ Failed to launch Google Login');
        }
    };

    const handleLogout = async () => {
        setIsLoading(true);
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Sign out error:', error);
            setSyncStatus('❌ Đăng xuất thất bại');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">
                {userEmail ? `Đang đăng nhập: ${userEmail}` : 'Chưa đăng nhập'}
            </p>

            <button
                onClick={handleLogin}
                disabled={isLoading || isSyncing || Boolean(userEmail) || !hasSupabaseConfig}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
                {isLoading ? 'Redirecting to Google...' : 'Connect Google Calendar'}
            </button>

            <button
                onClick={handleLogout}
                disabled={isLoading || isSyncing || !userEmail}
                className="px-6 py-2 bg-slate-200 text-slate-900 font-medium rounded-md hover:bg-slate-300 disabled:opacity-50 transition-colors"
            >
                Logout
            </button>
            
            {syncStatus && (
                <p className={`text-sm font-medium ${syncStatus.includes('❌') ? 'text-red-500' : 'text-green-600'}`}>
                    {syncStatus}
                </p>
            )}

            {configError && <p className="text-sm font-medium text-red-500">{configError}</p>}
        </div>
    );
}