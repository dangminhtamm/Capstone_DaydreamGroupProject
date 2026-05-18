import { DashboardShell } from "@/components/dashboard-shell";
import { SummaryDashboard } from "@/components/summary-dashboard";

export default function SummaryPage() {
  return (
    <DashboardShell
      title="Summary Dashboard"
      description="Review daily activity, weekly trends, and writing statistics from your diary memories."
    >
      <SummaryDashboard />
    </DashboardShell>
  );
}
