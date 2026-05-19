"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { supabase } = useAuth();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Processing your authentication...");

  useEffect(() => {
    if (!supabase) {
      setStatus("error");
      setMessage("Authentication service is not configured.");
      return;
    }

    const handleCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setStatus("error");
          setMessage(error.message);
          return;
        }

        if (data.session) {
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
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-700 dark:bg-slate-800">
      {status === "processing" && (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40">
            <svg className="h-7 w-7 animate-spin text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/40">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40">
              <svg className="h-7 w-7 animate-spin text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
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
