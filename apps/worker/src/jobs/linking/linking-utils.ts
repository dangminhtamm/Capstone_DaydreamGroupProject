export function extractKeywords(text: string): string[] {
  if (!text) return [];
  const stopWords = ['là', 'và', 'của', 'ở', 'trong', 'với', 'cho', 'có', 'thì', 'mà'];
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 2 && !stopWords.includes(word));
}
