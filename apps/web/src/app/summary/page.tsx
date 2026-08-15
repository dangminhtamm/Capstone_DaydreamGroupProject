import { DashboardShell } from "@/components/dashboard-shell";
import { SummaryDashboard } from "@/components/summary-dashboard";

export default function SummaryPage() {
  return (
    <DashboardShell
      title="Summary"
      description="See what you have been focusing on, how your week felt, and what changed over time."
    >
      <SummaryDashboard />
    </DashboardShell>
  );
}
