import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";

export default function HomePage() {
  return (
    <DashboardShell
      title="Frontend Week 1"
      description="Core UI, diary input, and timeline mock for smooth demo flow."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/diary"
          className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300"
        >
          <h3 className="text-lg font-semibold">Diary Input UI</h3>
          <p className="mt-1 text-sm text-slate-600">Create diary entry with mood and UX states.</p>
        </Link>

        <Link
          href="/timeline"
          className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300"
        >
          <h3 className="text-lg font-semibold">Timeline UI</h3>
          <p className="mt-1 text-sm text-slate-600">Show diary history with mock data entries.</p>
        </Link>
      </div>
    </DashboardShell>
  );
}
