import { DashboardShell } from "@/components/dashboard-shell";
import { TimelineList } from "@/components/timeline-list";
import { mockTimelineEntries } from "@/lib/mock-data";

export default function TimelinePage() {
  return (
    <DashboardShell
      title="Timeline"
      description="Week 1 timeline using mock data to demonstrate end-to-end interaction flow."
    >
      <TimelineList entries={mockTimelineEntries} />
    </DashboardShell>
  );
}
