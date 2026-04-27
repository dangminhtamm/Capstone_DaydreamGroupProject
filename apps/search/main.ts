type SearchRequest = {
  question: string;
};

type SearchResponse = {
  answer: string;
  sources: string[];
};

export async function askAI(payload: SearchRequest): Promise<SearchResponse> {
  const trimmed = payload.question.trim();

  if (!trimmed) {
    throw new Error("Question is required");
  }

  return {
    answer: "Mock answer: backend search service is not connected yet.",
    sources: ["diary:mock-entry-1", "calendar:mock-event-1"],
  };
}
