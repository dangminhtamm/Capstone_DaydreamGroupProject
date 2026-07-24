import { DashboardShell } from "@/components/dashboard-shell";
import { SummaryDashboard } from "@/components/summary-dashboard";

export default function SummaryPage() {
  return (
    <DashboardShell
      title="Summary"
      description="Review AI reflections, focus trends, mood patterns, and writing activity."
    >
      <SummaryDashboard />
    </DashboardShell>
  );
}
