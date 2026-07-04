/**
 * Search History & Cache helpers for the Second Brain project.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface SaveSearchHistoryInput {
  userId: string;
  question: string;
  answer: string;
  confidence: string;
  sourcesJson?: string | null;
  analyticsJson?: string | null;
  responseLanguage: string;
  tokenCount: number;
}

export async function saveSearchHistory(
  client: any,
  input: SaveSearchHistoryInput,
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

  return client.searchHistory.create({
    data: {
      user_id: input.userId,
      question: input.question,
      answer: input.answer,
      confidence: input.confidence,
      sources_json: input.sourcesJson ?? null,
      analytics_json: input.analyticsJson ?? null,
      response_language: input.responseLanguage,
      token_count: input.tokenCount,
      created_at: now,
      expires_at: expiresAt,
    },
  });
}

export async function findCachedAnswer(
  client: any,
  userId: string,
  question: string,
  responseLanguage: string,
) {
  const now = new Date();
  return client.searchHistory.findFirst({
    where: {
      user_id: userId,
      question: question,
      response_language: responseLanguage,
      expires_at: { gt: now },
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function getUserSearchHistory(
  client: any,
  userId: string,
  limit: number = 20,
) {
  return client.searchHistory.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: limit,
    select: {
      id: true,
      question: true,
      answer: true,
      confidence: true,
      response_language: true,
      token_count: true,
      created_at: true,
      expires_at: true,
    },
  });
}

export async function deleteSearchHistoryItem(
  client: any,
  userId: string,
  id: string,
) {
  return client.searchHistory.deleteMany({
    where: { id, user_id: userId },
  });
}

export async function clearUserSearchHistory(
  client: any,
  userId: string,
) {
  return client.searchHistory.deleteMany({
    where: { user_id: userId },
  });
}
