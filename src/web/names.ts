const STORAGE_KEY = "tally.hideNames";

export function readHideNames(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeHideNames(hide: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, hide ? "1" : "0");
  } catch {
    return;
  }
}

export function displayAuthor(author: string, hideNames: boolean): string {
  if (!hideNames) return author;
  return `viewer-${authorTag(author)}`;
}

export function displayText(text: string, hideNames: boolean): string {
  if (!hideNames) return text;
  return text.replace(/@[\p{L}\p{N}_]+/gu, (mention) => `@${displayAuthor(mention.slice(1), true)}`);
}

export function authorTag(author: string): string {
  let hash = 2166136261;
  for (const char of author.normalize("NFKC")) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(4, "0").slice(0, 4);
}

export function redactLogRequest(request: unknown, hideNames: boolean): unknown {
  if (!hideNames || request == null || typeof request !== "object") return request;
  const body = request as { state?: unknown };
  return { ...body, state: redactState(body.state) };
}

function redactState(state: unknown): unknown {
  if (state == null || typeof state !== "object") return state;
  const record = state as { chats?: unknown };
  if (!Array.isArray(record.chats)) return state;
  return {
    ...record,
    chats: record.chats.map((chat) => {
      if (chat == null || typeof chat !== "object") return chat;
      const row = chat as { author?: unknown; text?: unknown };
      return {
        ...row,
        ...(typeof row.author === "string" ? { author: displayAuthor(row.author, true) } : {}),
        ...(typeof row.text === "string" ? { text: displayText(row.text, true) } : {}),
      };
    }),
  };
}
