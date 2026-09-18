import { useEffect, useState } from "react";
import type { ModelLog, Poll, ScoredLine, SessionResponse } from "../shared/api.ts";
import { getJson, messageOf } from "./api.ts";
import { Modal } from "./Modal.tsx";
import { ModelLogs } from "./ModelLogs.tsx";
import { Overlay } from "./PollCard.tsx";
import { PollForm } from "./PollForm.tsx";
import { Polls } from "./Polls.tsx";
import { Watch } from "./Watch.tsx";
import { blankPoll } from "../tally/seed.ts";
import { readHideNames, writeHideNames } from "./names.ts";

export function App() {
  const overlay = window.location.pathname.startsWith("/overlay");
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [editing, setEditing] = useState<Poll | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [author, setAuthor] = useState("viewer");
  const [text, setText] = useState("");
  const [channel, setChannel] = useState("");
  const [hideNames, setHideNames] = useState(readHideNames);

  function apply(next: SessionResponse) {
    setSession((current) => ({
      ...next,
      lines: current ? mergeLines(next.lines, current.lines) : next.lines,
      logs: next.logs ?? current?.logs ?? [],
    }));
    setSelectedLine((id) => id ?? next.lines[0]?.id ?? null);
    if (next.twitch.channel) setChannel(next.twitch.channel);
  }

  useEffect(() => {
    getJson<SessionResponse>("/api/session")
      .then(apply)
      .catch((err: unknown) => setError(messageOf(err)));
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.addEventListener("hello", (event) => {
      apply(JSON.parse((event as MessageEvent).data) as SessionResponse);
    });
    source.addEventListener("pending", (event) => {
      const { line, queue, seedRemaining } = JSON.parse(
        (event as MessageEvent).data,
      ) as {
        line: SessionResponse["lines"][number];
        queue: SessionResponse["queue"];
        seedRemaining?: number;
      };
      setSession((current) =>
        current
          ? {
              ...current,
              lines: mergeLines(
                [line, ...current.lines.filter((item) => item.id !== line.id)],
                current.lines,
              ).slice(0, 200),
              queue,
              seedRemaining: seedRemaining ?? current.seedRemaining,
            }
          : current,
      );
      setSelectedLine(line.id);
    });
    source.addEventListener("score", (event) => {
      const body = JSON.parse((event as MessageEvent).data) as Pick<
        SessionResponse,
        "lines" | "tallies" | "last" | "queue" | "inputTokens"
      >;
      setSession((current) =>
        current ? { ...current, ...body, lastError: null } : current,
      );
    });
    source.addEventListener("polls", (event) => {
      const body = JSON.parse((event as MessageEvent).data) as Pick<
        SessionResponse,
        "polls" | "tallies"
      >;
      setSession((current) => (current ? { ...current, ...body } : current));
    });
    source.addEventListener("twitch", (event) => {
      const twitch = JSON.parse((event as MessageEvent).data) as SessionResponse["twitch"];
      setSession((current) => (current ? { ...current, twitch } : current));
    });
    source.addEventListener("queue", (event) => {
      const queue = JSON.parse((event as MessageEvent).data) as SessionResponse["queue"];
      setSession((current) => (current ? { ...current, queue } : current));
    });
    source.addEventListener("log", (event) => {
      const body = JSON.parse((event as MessageEvent).data) as {
        log: ModelLog;
        logs: ModelLog[];
      };
      setSession((current) =>
        current ? { ...current, logs: body.logs } : current,
      );
    });
    source.addEventListener("logs", (event) => {
      const body = JSON.parse((event as MessageEvent).data) as { logs: ModelLog[] };
      setSession((current) =>
        current ? { ...current, logs: body.logs } : current,
      );
    });
    source.addEventListener("error", (event) => {
      const data = (event as MessageEvent).data;
      if (typeof data !== "string" || !data) return;
      try {
        const body = JSON.parse(data) as { message: string };
        setError(body.message);
        setSession((current) =>
          current ? { ...current, lastError: body.message } : current,
        );
      } catch {
        return;
      }
    });
    source.onerror = () => undefined;
    return () => source.close();
  }, []);

  async function run(path: string, init?: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const next = await getJson<SessionResponse>(path, init);
      if (path === "/api/chat" || path === "/api/play") {
        setSession((current) =>
          current ? { ...current, seedRemaining: next.seedRemaining } : next,
        );
        return true;
      }
      apply(next);
      return true;
    } catch (err: unknown) {
      setError(messageOf(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <div className="shell">
        <p className="muted">{error ?? "Loading Tally…"}</p>
      </div>
    );
  }

  if (overlay) {
    return <Overlay session={session} />;
  }

  return (
    <div className="shell">
      <header className="top">
        <h1>Tally</h1>
        <div className="top-actions">
          <span className={`pill ${session.mode}`}>{session.mode}</span>
          <span className="pill" title="Total Jev input tokens this session">
            {session.inputTokens.toLocaleString()} in
          </span>
          <button
            className={`ghost ${hideNames ? "pressed" : ""}`}
            type="button"
            aria-pressed={hideNames}
            onClick={() => {
              const next = !hideNames;
              setHideNames(next);
              writeHideNames(next);
            }}
          >
            {hideNames ? "Names hidden" : "Hide names"}
          </button>
          <button className="ghost" onClick={() => setLogsOpen(true)}>
            Model logs
          </button>
          <button className="ghost" disabled={busy} onClick={() => void run("/api/reset", { method: "POST" })}>
            Reset feed
          </button>
        </div>
      </header>

      {session.mode === "mock" && (
        <p className="banner">
          Mock evaluator — not Jev. Set <code>TYPESAFE_API_KEY</code> for live scoring.
        </p>
      )}
      {session.mode === "unconfigured" && (
        <p className="banner error">
          No Jev key. Add <code>TYPESAFE_API_KEY</code> or <code>TALLY_ALLOW_MOCK=1</code>.
        </p>
      )}
      {(error || session.lastError) && (
        <p className="banner error">{error || session.lastError}</p>
      )}

      <div className="layout mvp">
        <Polls
          session={session}
          busy={busy}
          onNew={() => setEditing(blankPoll(session.polls.map((poll) => poll.id)))}
          onEdit={setEditing}
          onResetTally={(id) => void run(`/api/polls/${id}/reset`, { method: "POST" })}
        />
        <Watch
          session={session}
          selectedId={selectedLine}
          onSelect={setSelectedLine}
          busy={busy}
          author={author}
          hideNames={hideNames}
          text={text}
          channel={channel}
          onAuthor={setAuthor}
          onText={setText}
          onSend={() => {
            const value = text.trim();
            if (!value) return;
            void run("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ author, text: value }),
            }).finally(() => setText(""));
          }}
          onPlay={() =>
            void run("/api/play", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ count: 1 }),
            })
          }
          onPlayRest={() => {
            void (async () => {
              setBusy(true);
              setError(null);
              try {
                let remaining = session.seedRemaining;
                while (remaining > 0) {
                  const next = await getJson<SessionResponse>("/api/play", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ count: Math.min(8, remaining) }),
                  });
                  remaining = next.seedRemaining;
                  setSession((current) =>
                    current
                      ? { ...current, seedRemaining: next.seedRemaining }
                      : next,
                  );
                }
              } catch (err: unknown) {
                setError(messageOf(err));
              } finally {
                setBusy(false);
              }
            })();
          }}
          onConnect={(eventsub) =>
            void run("/api/twitch/connect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ channel, eventsub }),
            })
          }
          onDisconnect={() => void run("/api/twitch/disconnect", { method: "POST" })}
          onChannel={setChannel}
        />
      </div>

      {editing && (
        <Modal
          title={session.polls.some((poll) => poll.id === editing.id) ? "Edit poll" : "New poll"}
          onClose={() => setEditing(null)}
        >
          <PollForm
            key={editing.id}
            poll={editing}
            polls={session.polls}
            busy={busy}
            onSave={(polls) =>
              void run("/api/polls", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ polls }),
              }).then((ok) => {
                if (ok) setEditing(null);
              })
            }
            onResetTally={(id) => void run(`/api/polls/${id}/reset`, { method: "POST" })}
          />
        </Modal>
      )}

      {logsOpen && (
        <Modal title="Model logs" wide onClose={() => setLogsOpen(false)}>
          <ModelLogs
            logs={session.logs}
            hideNames={hideNames}
            busy={busy}
            onClear={() => void run("/api/logs/clear", { method: "POST" })}
          />
        </Modal>
      )}
    </div>
  );
}

function mergeLines(incoming: ScoredLine[], previous: ScoredLine[]): ScoredLine[] {
  const prev = new Map(previous.map((line) => [line.id, line]));
  return incoming.map((line) => {
    const old = prev.get(line.id);
    if (old && statusRank(old) > statusRank(line)) return old;
    return line;
  });
}

function statusRank(line: ScoredLine): number {
  if (line.status === "scored") return 2;
  if (line.status === "error") return 1;
  return 0;
}
