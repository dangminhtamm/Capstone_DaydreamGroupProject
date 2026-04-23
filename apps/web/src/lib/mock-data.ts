import type { IDiaryEntry } from "@second-brain/shared";

export const mockTimelineEntries: IDiaryEntry[] = [
  {
    id: "entry-001",
    title: "Productive Monday",
    content:
      "Focused deeply on frontend wireframes and finalized the diary input interactions.",
    mood: "great",
    createdAt: "2026-04-20T08:15:00.000Z",
  },
  {
    id: "entry-002",
    title: "Sync with team",
    content:
      "Aligned with Nhan on explainability blocks and discussed loading and error UI states.",
    mood: "good",
    createdAt: "2026-04-19T11:45:00.000Z",
  },
  {
    id: "entry-003",
    title: "Need better focus",
    content:
      "Got distracted during implementation. Planned tighter task blocks for tomorrow.",
    mood: "neutral",
    createdAt: "2026-04-18T14:05:00.000Z",
  },
];
