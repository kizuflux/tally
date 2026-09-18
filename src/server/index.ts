import { config as loadEnv } from "dotenv";
import crypto from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

loadEnv({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../..", ".env"),
  override: true,
});
import { createEvaluator } from "../runtime/client.ts";
import { TallyHub } from "./hub.ts";
import { EventSubClient } from "../twitch/eventsub.ts";
import { IrcClient } from "../twitch/irc.ts";
import {
  authorizeUrl,
  exchangeCode,
  loadTokens,
  twitchAppConfigured,
} from "../twitch/oauth.ts";

const { evaluator, mode } = createEvaluator();
const modelName = process.env.TYPESAFE_DEFAULT_MODEL || "jev-latest";
const hub = new TallyHub(evaluator, mode, modelName);
const irc = new IrcClient((chat) => hub.enqueue(chat));
const eventsub = new EventSubClient((chat) => hub.enqueue(chat));
const oauthStates = new Set<string>();

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  const snap = hub.snapshot();
  res.json({
    ok: hub.mode !== "unconfigured",
    mode: hub.mode,
    model: snap.model,
    last: snap.last,
    lastError: snap.lastError,
  });
});

app.get("/api/session", (_req, res) => {
  res.json(hub.snapshot());
});

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const unsub = hub.subscribe({
    write: (chunk) => {
      res.write(chunk);
    },
  });
  req.on("close", unsub);
});

app.post("/api/reset", (_req, res) => {
  hub.resetSession();
  res.json(hub.snapshot());
});

app.post("/api/logs/clear", (_req, res) => {
  hub.clearLogs();
  res.json(hub.snapshot());
});

app.post("/api/polls", async (req, res) => {
  try {
    await hub.setPolls(req.body?.polls ?? req.body);
    res.json(hub.snapshot());
  } catch (error) {
    res.status(400).json({ error: messageOf(error) });
  }
});

app.post("/api/polls/:id/reset", (req, res) => {
  try {
    hub.resetTally(String(req.params.id));
    res.json(hub.snapshot());
  } catch (error) {
    res.status(400).json({ error: messageOf(error) });
  }
});

app.post("/api/chat", (req, res) => {
  const text = String(req.body?.text ?? "").trim();
  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  const author = String(req.body?.author ?? "viewer").trim() || "viewer";
  hub.enqueue({ author, text });
  if (unconfigured(res)) return;
  res.json(hub.snapshot());
});

app.post("/api/play", (req, res) => {
  try {
    hub.playSeed(Number(req.body?.count ?? 1) || 1);
    if (unconfigured(res)) return;
    res.json(hub.snapshot());
  } catch (error) {
    res.status(400).json({ error: messageOf(error) });
  }
});

app.post("/api/twitch/connect", async (req, res) => {
  const channel = String(req.body?.channel ?? "")
    .replace(/^#/, "")
    .trim()
    .toLowerCase();
  if (!channel) {
    res.status(400).json({ error: "channel is required" });
    return;
  }
  const tokens = await loadTokens();
  const wantEventSub =
    req.body?.eventsub === true ||
    (req.body?.eventsub !== false && Boolean(tokens) && twitchAppConfigured());
  irc.disconnect();
  eventsub.disconnect();
  try {
    if (wantEventSub) {
      await eventsub.connect(channel);
      hub.setTwitch({
        channel,
        transport: "eventsub",
        connected: true,
        message: null,
      });
    } else {
      irc.connect(channel);
      hub.setTwitch({
        channel,
        transport: "irc",
        connected: true,
        message: null,
      });
    }
    res.json(hub.snapshot());
  } catch (error) {
    hub.setTwitch({
      channel,
      transport: "off",
      connected: false,
      message: messageOf(error),
    });
    res.status(500).json({ error: messageOf(error) });
  }
});

app.post("/api/twitch/disconnect", (_req, res) => {
  irc.disconnect();
  eventsub.disconnect();
  hub.setTwitch({
    channel: null,
    transport: "off",
    connected: false,
    message: null,
  });
  res.json(hub.snapshot());
});

app.get("/api/twitch/login", (_req, res) => {
  if (!twitchAppConfigured()) {
    res.status(400).json({ error: "Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET" });
    return;
  }
  const state = crypto.randomBytes(12).toString("hex");
  oauthStates.add(state);
  res.redirect(authorizeUrl(state));
});

app.get("/api/twitch/callback", async (req, res) => {
  const state = String(req.query.state ?? "");
  const code = String(req.query.code ?? "");
  if (!oauthStates.has(state) || !code) {
    res.status(400).send("Invalid Twitch OAuth callback");
    return;
  }
  oauthStates.delete(state);
  try {
    await exchangeCode(code);
    hub.setTwitch({ oauthReady: true, message: "Twitch signed in" });
    res.redirect("http://127.0.0.1:5175/");
  } catch (error) {
    res.status(500).send(messageOf(error));
  }
});

const port = Number(process.env.PORT || 8788);

await hub.init();
hub.setTwitch({
  oauthReady: Boolean(await loadTokens()) && twitchAppConfigured(),
  oauthConfigured: twitchAppConfigured(),
});

app.listen(port, () => {
  console.log(`Tally server on http://127.0.0.1:${port} (${hub.mode})`);
});

function unconfigured(res: express.Response): boolean {
  if (hub.mode !== "unconfigured") return false;
  res.status(503).json({
    error:
      "Set TYPESAFE_API_KEY for live Jev, or TALLY_ALLOW_MOCK=1 for the keyword mock.",
  });
  return true;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
