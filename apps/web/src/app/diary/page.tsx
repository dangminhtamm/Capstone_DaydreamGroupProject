import { DashboardShell } from "@/components/dashboard-shell";
import { DiaryInputForm } from "@/components/diary-input-form";

export default function DiaryPage() {
  return (
    <DashboardShell
      title="Diary Input"
      description="Create daily entries for memory grounding and later summarization."
    >
      <DiaryInputForm />
    </DashboardShell>
  );
}
