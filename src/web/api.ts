export async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || response.statusText);
  return body;
}

export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
