# Tally

A **live semantic poll overlay** for stream chat. The streamer maintains a list of polls (context + options + optional alert flags). Chat is scored by Jev: is this a vote, which option, how sure. Code tallies **probability mass**. Tally does not speak in chat.

```
Twitch IRC / EventSub / paste / seed
        │
        ▼
  pending line (SSE immediately)
        │
        ▼
  Jev fan-out     every active poll × on_topic / pick / flags
        │
        ▼
  overlay         bars + per-poll tags
```

## Run

Node 20+.

```powershell
copy .env.example .env
# put TYPESAFE_API_KEY in .env  (or TALLY_ALLOW_MOCK=1 for local keyword mock)
npm install
npm test
npm run dev
```

UI: [http://127.0.0.1:5175](http://127.0.0.1:5175)  
OBS bars-only: [http://127.0.0.1:5175/overlay](http://127.0.0.1:5175/overlay)  
API: [http://127.0.0.1:8788](http://127.0.0.1:8788)

## Live Jev

`TYPESAFE_API_KEY` is required for real scoring. Get a key from the [TypeSafe console](https://console.typesafe.ai/settings/keys). The key never leaves the server.

Without a key, set `TALLY_ALLOW_MOCK=1` to use keyword overlap (not Jev) so the UI still runs.

## Twitch

1. Type a channel and **Connect IRC** to read public chat anonymously (`justinfan`). Unofficial; enough to watch a live feed.
2. Optional EventSub: register a Twitch app, set `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET`, redirect `http://127.0.0.1:8788/api/twitch/callback`, **Sign in with Twitch**, then **Connect EventSub**.
3. **Chat popout** only opens Twitch’s UI beside Tally. It is not the ingest.

Polls persist in `data/tally.json`. Chat history does not.

## Layout

- [`src/runtime`](src/runtime) — live/mock evaluator
- [`src/tally`](src/tally) — polls, questions, scoring, store
- [`src/twitch`](src/twitch) — IRC + EventSub
- [`src/server`](src/server) — Express, queue, SSE
- [`src/web`](src/web) — watch + editor

See [ROADMAP.md](ROADMAP.md) and [AGENTS.md](AGENTS.md).
