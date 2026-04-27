'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase Client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function GoogleAuthButton() {
    const [isLoading, setIsLoading] = useState(false);
    const [syncStatus, setSyncStatus] = useState<string>('');

    useEffect(() => {
        // Listen for auth state changes (triggers when the user returns from Google)
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                console.log('Google Sign-In successful. Starting backend sync...');
                setSyncStatus('Syncing with backend...');

                const jwt = session.access_token;
                const googleAccessToken = session.provider_token;
                const googleRefreshToken = session.provider_refresh_token;

                if (!jwt) {
                    console.error('No JWT found in session!');
                    setSyncStatus('Error: Missing JWT');
                    return;
                }

                try {
                    // Fallback to localhost:3001 if the env variable fails to load
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

                    // Sync with the NestJS Backend
                    const response = await fetch(`${apiUrl}/auth/sync`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            // THIS LINE IS CRITICAL: It proves to NestJS who you are!
                            'Authorization': `Bearer ${jwt}`,
                        },
                        body: JSON.stringify({
                            google_access_token: googleAccessToken,
                            google_refresh_token: googleRefreshToken,
                        }),
                    });

                    if (!response.ok) {
                        // Parse the exact error from NestJS to make debugging instantly clear
                        const errorData = await response.json().catch(() => ({}));
                        console.error('Backend rejected the sync:', errorData);
                        throw new Error(`Backend sync failed: HTTP ${response.status} - ${errorData.message || 'Unknown Error'}`);
                    }

                    console.log('🎉 User successfully synced to the database!');
                    setSyncStatus('✅ Sync complete! Tokens saved.');
                    
                    // Optional: Redirect the user after a successful login
                    // setTimeout(() => { window.location.href = '/dashboard'; }, 1500);

                } catch (error) {
                    console.error('Error syncing user:', error);
                    setSyncStatus('❌ Sync failed. Check console.');
                }
            }
        });

        // Cleanup listener on unmount
        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const handleLogin = async () => {
        setIsLoading(true);
        setSyncStatus('');
        
        try {
            await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    queryParams: {
                        access_type: 'offline', // CRITICAL: Gives you the refresh_token
                        prompt: 'consent',      // Forces the consent screen so the refresh_token is always generated
                    },
                    // Requesting profile, email, AND calendar access
                    scopes: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.readonly',
                },
            });
        } catch (error) {
            console.error("OAuth Error:", error);
            setIsLoading(false);
            setSyncStatus('❌ Failed to launch Google Login');
        }
    };

    return (
        <div className="flex flex-col items-center gap-3">
            <button
                onClick={handleLogin}
                disabled={isLoading}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
                {isLoading ? 'Redirecting to Google...' : 'Connect Google Calendar'}
            </button>
            
            {/* Visual feedback so you know exactly what is happening */}
            {syncStatus && (
                <p className={`text-sm font-medium ${syncStatus.includes('Error') || syncStatus.includes('failed') ? 'text-red-500' : 'text-green-600'}`}>
                    {syncStatus}
                </p>
            )}
        </div>
    );
}