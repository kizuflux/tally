const STOP = new Set([
  "a",
  "an",
  "the",
  "to",
  "for",
  "of",
  "and",
  "or",
  "my",
  "me",
  "on",
  "in",
  "at",
  "with",
  "this",
  "that",
  "from",
  "is",
  "it",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 1 && !STOP.has(w));
}
