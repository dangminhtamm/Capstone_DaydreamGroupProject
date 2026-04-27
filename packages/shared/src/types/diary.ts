export interface IDiaryEntry {
  id: string;
  title: string;
  content: string;
  mood: "great" | "good" | "neutral" | "bad";
  createdAt: string;
}

export interface IDiaryDraft {
  title: string;
  content: string;
  mood: IDiaryEntry["mood"];
}
