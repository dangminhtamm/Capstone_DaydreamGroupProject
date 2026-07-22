export function toVectorLiteral(embedding: number[]): string {
  if (embedding.length === 0) {
    throw new Error("Embedding must be a non-empty number array.");
  }

  const normalized = embedding.map((value) => {
    if (!Number.isFinite(value)) {
      throw new Error("Embedding values must be finite numbers.");
    }

    return Number(value.toFixed(6));
  });

  return `[${normalized.join(",")}]`;
}
