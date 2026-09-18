import { helixUser, validAccessToken } from "./oauth.ts";

export type ChatHandler = (chat: { author: string; text: string }) => void;

type Welcome = {
  metadata: { message_type: string };
  payload: {
    session?: { id: string; reconnect_url?: string };
    event?: {
      chatter_user_login?: string;
      chatter_user_name?: string;
      message?: { text?: string };
    };
  };
};

export class EventSubClient {
  private socket: WebSocket | null = null;
  private closed = false;
  channel: string | null = null;

  constructor(private readonly onChat: ChatHandler) {}

  async connect(channel: string) {
    this.disconnect();
    this.closed = false;
    this.channel = channel.replace(/^#/, "").toLowerCase();
    await this.open();
  }

  disconnect() {
    this.closed = true;
    this.socket?.close();
    this.socket = null;
    this.channel = null;
  }

  private async open(url = "wss://eventsub.wss.twitch.tv/ws") {
    if (this.closed || !this.channel) return;
    const tokens = await validAccessToken();
    if (!tokens) throw new Error("Sign in with Twitch first");
    const broadcaster = await helixUser(tokens.access_token, this.channel);

    const socket = new WebSocket(url);
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as Welcome;
      const type = message.metadata?.message_type;
      if (type === "session_welcome") {
        const sessionId = message.payload.session?.id;
        if (sessionId) {
          void subscribe(tokens.access_token, sessionId, broadcaster.id, tokens.user_id);
        }
        return;
      }
      if (type === "session_reconnect") {
        const next = message.payload.session?.reconnect_url;
        if (next) {
          socket.close();
          void this.open(next);
        }
        return;
      }
      if (type === "notification") {
        const chat = message.payload.event;
        const text = chat?.message?.text?.trim();
        if (!text) return;
        this.onChat({
          author: chat?.chatter_user_name || chat?.chatter_user_login || "viewer",
          text,
        });
      }
    });
    socket.addEventListener("close", () => {
      if (this.closed) return;
      setTimeout(() => {
        void this.open().catch(() => undefined);
      }, 2000);
    });
  }
}

async function subscribe(
  accessToken: string,
  sessionId: string,
  broadcasterUserId: string,
  userId: string,
) {
  const response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "channel.chat.message",
      version: "1",
      condition: {
        broadcaster_user_id: broadcasterUserId,
        user_id: userId,
      },
      transport: { method: "websocket", session_id: sessionId },
    }),
  });
  if (!response.ok && response.status !== 409) {
    const body = await response.text();
    throw new Error(`EventSub subscribe failed (${response.status}): ${body}`);
  }
}
