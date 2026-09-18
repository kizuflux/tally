import { parseIrcDisplayName, parseIrcLine } from "./irc-parse.ts";

export type ChatHandler = (chat: { author: string; text: string }) => void;

export class IrcClient {
  private socket: WebSocket | null = null;
  private closed = false;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  channel: string | null = null;

  constructor(private readonly onChat: ChatHandler) {}

  connect(channel: string) {
    this.disconnect();
    this.closed = false;
    this.channel = channel.replace(/^#/, "").toLowerCase();
    this.open();
  }

  disconnect() {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
    this.channel = null;
  }

  private open() {
    if (!this.channel || this.closed) return;
    const nick = `justinfan${Math.floor(10000 + Math.random() * 90000)}`;
    const socket = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.attempt = 0;
      socket.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      socket.send("PASS SCHMOOPIE");
      socket.send(`NICK ${nick}`);
      socket.send(`JOIN #${this.channel}`);
    });
    socket.addEventListener("message", (event) => {
      const payload = String(event.data);
      for (const raw of payload.split(/\r?\n/)) {
        if (!raw.trim()) continue;
        const parsed = parseIrcLine(raw);
        if (parsed.type === "ping") {
          socket.send(`PONG ${parsed.token}`);
          continue;
        }
        if (parsed.type === "privmsg") {
          const author = parseIrcDisplayName(raw) || parsed.author;
          this.onChat({ author, text: parsed.text });
        }
      }
    });
    socket.addEventListener("close", () => {
      if (this.closed) return;
      this.scheduleReconnect();
    });
    socket.addEventListener("error", () => {
      socket.close();
    });
  }

  private scheduleReconnect() {
    this.attempt += 1;
    const delay = Math.min(15_000, 500 * 2 ** this.attempt);
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }
}
