import { DashboardShell } from "@/components/dashboard-shell";
import { DiaryInputForm } from "@/components/diary-input-form";

export default function DiaryPage() {
  return (
    <DashboardShell
      title="Diary"
      description="Capture a memory with mood, tags, attachments, and calendar context."
    >
      <DiaryInputForm />
    </DashboardShell>
  );
}
