type AskPayload = {
  question: string;
};

type AskResponse = {
  answer: string;
  sources: string[];
};

export async function askSearch(payload: AskPayload): Promise<AskResponse> {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch answer");
  }

  return response.json() as Promise<AskResponse>;
}
