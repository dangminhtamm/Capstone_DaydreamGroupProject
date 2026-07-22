export function extractKeywords(text: string): string[] {
  if (!text) return [];

  const stopWords = ['la', 'va', 'cua', 'o', 'trong', 'voi', 'cho', 'co', 'thi', 'ma', 'toi', 'di', 'lam', 'cac', 'nhung', 'mot', 'cac'];

  const normalizedText = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

  const matches = normalizedText.match(/[\p{L}\p{N}_]+/gu) || [];

  return matches.filter((word) => word.length > 2 && !stopWords.includes(word));
}