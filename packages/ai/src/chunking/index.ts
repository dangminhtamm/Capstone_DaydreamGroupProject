export function chunkDiaryText(text: string): string[] {
  return text.split(/\n{2,}/).filter(Boolean);
}
