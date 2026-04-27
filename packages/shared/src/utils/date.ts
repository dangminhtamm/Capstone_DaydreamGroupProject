export function formatDateTime(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
