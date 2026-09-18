export type IrcEvent =
  | { type: "ping"; token: string }
  | { type: "privmsg"; author: string; channel: string; text: string }
  | { type: "other"; raw: string };

export function parseIrcLine(raw: string): IrcEvent {
  const line = raw.trim();
  if (!line) return { type: "other", raw };
  if (line.startsWith("PING ")) {
    return { type: "ping", token: line.slice(5).trim() };
  }

  let rest = line;
  if (rest.startsWith("@")) {
    const split = rest.indexOf(" ");
    rest = split === -1 ? rest : rest.slice(split + 1);
  }

  const match = /^:([^!\s]+)![^ ]+ PRIVMSG (#\S+) :(.*)$/.exec(rest);
  if (!match) return { type: "other", raw: line };
  return {
    type: "privmsg",
    author: match[1] ?? "unknown",
    channel: match[2] ?? "",
    text: match[3] ?? "",
  };
}

export function parseIrcDisplayName(raw: string): string | null {
  const tags = raw.startsWith("@") ? raw.slice(1, raw.indexOf(" ")) : "";
  const piece = tags.split(";").find((part) => part.startsWith("display-name="));
  const name = piece?.slice("display-name=".length);
  return name ? name : null;
}
