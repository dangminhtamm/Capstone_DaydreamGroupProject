import { DashboardShell } from "@/components/dashboard-shell";
import { TimelineContainer } from "@/components/timeline-container";

export default function TimelinePage() {
  return (
    <DashboardShell
      title="Timeline"
      description="View your diary entries and track your journey."
    >
      <TimelineContainer />
    </DashboardShell>
  );
}
