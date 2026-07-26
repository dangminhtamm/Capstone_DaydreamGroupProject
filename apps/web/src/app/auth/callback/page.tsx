"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { syncSessionWithBackend } from "@/lib/auth-flow";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { supabase } = useAuth();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Processing your authentication...");
  const hasProcessedCallback = useRef(false);

  useEffect(() => {
    if (!supabase) {
      setStatus("error");
      setMessage("Authentication service is not configured.");
      return;
    }

    const handleCallback = async () => {
      if (hasProcessedCallback.current) return;
      hasProcessedCallback.current = true;

      try {
        const authError = searchParams.get("error_description") || searchParams.get("error");
        if (authError) {
          setStatus("error");
          setMessage(authError);
          return;
        }

        const code = searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setStatus("error");
            setMessage(exchangeError.message);
            return;
          }
        }

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setStatus("error");
          setMessage(error.message);
          return;
        }

        if (data.session) {
          await syncSessionWithBackend(data.session).catch((syncError) => {
            console.warn(
              "[Auth] Backend sync after OAuth callback failed:",
              syncError instanceof Error ? syncError.message : syncError,
            );
          });

          const type = searchParams.get("type");

          if (type === "recovery") {
            setStatus("success");
            setMessage("Password reset confirmed. Redirecting...");
            setTimeout(() => router.push("/diary"), 2000);
          } else {
            setStatus("success");
            setMessage("Email confirmed! Redirecting to your diary...");
            setTimeout(() => router.push("/diary"), 1500);
          }
        } else {
          setStatus("success");
          setMessage("Email confirmed! You can now sign in.");
          setTimeout(() => router.push("/login"), 2000);
        }
      } catch {
        setStatus("error");
        setMessage("Something went wrong during authentication.");
      }
    };

    handleCallback();
  }, [supabase, router, searchParams]);

  return (
    <div className="w-full max-w-md enterprise-card p-8 text-center">
      {status === "processing" && (
        <>
          <div className="mx-auto space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="skeleton-line mx-auto h-3 w-36" />
            <div className="skeleton-line mx-auto h-3 w-24" />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-400">{message}</p>
        </>
      )}

      {status === "success" && (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <svg className="h-7 w-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-300">{message}</p>
        </>
      )}

      {status === "error" && (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40">
            <svg className="h-7 w-7 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-medium text-rose-700 dark:text-rose-300">{message}</p>
          <button
            onClick={() => router.push("/login")}
            className="mt-4 cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            Go to Login
          </button>
        </>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
      <Suspense
        fallback={
          <div className="w-full max-w-md enterprise-card p-8 text-center">
            <div className="mx-auto space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="skeleton-line mx-auto h-3 w-36" />
              <div className="skeleton-line mx-auto h-3 w-24" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-400">Processing...</p>
          </div>
        }
      >
        <CallbackContent />
      </Suspense>
    </div>
  );
}
