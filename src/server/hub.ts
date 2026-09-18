import type { EvaluatorMode } from "../runtime/client.ts";
import { capLogs, LoggingEvaluator } from "../runtime/logging.ts";
import type { SystemOneEvaluator } from "../runtime/types.ts";
import { MAX_BATCH, MAX_LINES, MAX_QUEUE } from "../tally/caps.ts";
import { ingestChats } from "../tally/ingest.ts";
import { normalizePolls } from "../tally/normalize.ts";
import { seedQueue } from "../tally/seed.ts";
import {
  applyLine,
  emptyTallies,
  emptyTally,
  errorLine,
  pendingLine,
} from "../tally/score.ts";
import { loadPolls, savePolls } from "../tally/store.ts";
import type {
  IncomingChat,
  Poll,
  QueueStats,
  ScoredLine,
  Tally,
  TwitchStatus,
} from "../tally/types.ts";
import type { ModelLog, SessionResponse } from "../shared/api.ts";

export type LastEval = SessionResponse["last"];

type Waiter = IncomingChat & { id: string };

type SseClient = { write: (chunk: string) => void; end?: () => void };

export class TallyHub {
  polls: Poll[] = [];
  tallies: Record<string, Tally> = {};
  lines: ScoredLine[] = [];
  seed: IncomingChat[] = seedQueue();
  last: LastEval = null;
  lastError: string | null = null;
  logs: ModelLog[] = [];
  inputTokens = 0;
  queue: QueueStats = {
    waiting: 0,
    inFlight: 0,
    dropped: 0,
    lagging: false,
  };
  twitch: TwitchStatus = {
    channel: null,
    transport: "off",
    connected: false,
    oauthReady: false,
    oauthConfigured: false,
    message: null,
  };

  private waiting: Waiter[] = [];
  private pumping = false;
  private readonly clients = new Set<SseClient>();

  constructor(
    evaluator: SystemOneEvaluator | null,
    readonly mode: EvaluatorMode,
    readonly model: string,
  ) {
    this.evaluator = evaluator
      ? new LoggingEvaluator(evaluator, (log) => this.pushLog(log))
      : null;
  }

  private evaluator: SystemOneEvaluator | null;

  async init() {
    this.polls = await loadPolls();
    this.tallies = emptyTallies(this.polls);
  }

  snapshot(): SessionResponse {
    this.queue.waiting = this.waiting.length;
    return {
      polls: this.polls,
      tallies: this.tallies,
      lines: this.lines,
      seedRemaining: this.seed.length,
      last: this.last,
      lastError: this.lastError,
      mode: this.mode,
      model: this.mode === "live" ? this.model : this.mode === "mock" ? "mock-jev" : "",
      queue: { ...this.queue },
      twitch: { ...this.twitch },
      logs: this.logs,
      inputTokens: this.inputTokens,
    };
  }

  subscribe(client: SseClient) {
    this.clients.add(client);
    this.emit("hello", this.snapshot());
    return () => {
      this.clients.delete(client);
    };
  }

  enqueue(chat: IncomingChat) {
    while (this.waiting.length >= MAX_QUEUE) {
      const dropped = this.waiting.shift();
      if (dropped) {
        this.patchLine(dropped.id, (line) =>
          errorLine(line, "Dropped; chat faster than Jev"),
        );
        this.queue.dropped += 1;
        this.queue.lagging = true;
      }
    }
    const line = pendingLine(chat);
    this.lines.unshift(line);
    this.lines = this.lines.slice(0, MAX_LINES);
    this.waiting.push({ author: line.author, text: line.text, id: line.id });
    this.queue.waiting = this.waiting.length;
    this.emit("pending", {
      line,
      queue: this.queue,
      seedRemaining: this.seed.length,
    });
    void this.pump();
  }

  async setPolls(input: unknown) {
    this.polls = normalizePolls(input);
    await savePolls(this.polls);
    const next = emptyTallies(this.polls);
    for (const poll of this.polls) {
      const prev = this.tallies[poll.id];
      if (prev && sameOptions(prev, poll)) next[poll.id] = prev;
    }
    this.tallies = next;
    this.emit("polls", { polls: this.polls, tallies: this.tallies });
  }

  resetTally(pollId: string) {
    const poll = this.polls.find((item) => item.id === pollId);
    if (!poll) throw new Error("Unknown poll");
    this.tallies[pollId] = emptyTally(poll);
    this.emit("polls", { polls: this.polls, tallies: this.tallies });
  }

  resetSession() {
    this.lines = [];
    this.waiting = [];
    this.seed = seedQueue();
    this.tallies = emptyTallies(this.polls);
    this.last = null;
    this.lastError = null;
    this.queue = {
      waiting: 0,
      inFlight: 0,
      dropped: this.queue.dropped,
      lagging: false,
    };
    this.emit("hello", this.snapshot());
  }

  playSeed(count: number) {
    const n = Math.min(MAX_BATCH, Math.max(1, count));
    const batch = this.seed.splice(0, n);
    if (batch.length === 0) throw new Error("seed queue is empty");
    for (const chat of batch) this.enqueue(chat);
  }

  setTwitch(partial: Partial<TwitchStatus>) {
    this.twitch = { ...this.twitch, ...partial };
    this.emit("twitch", this.twitch);
  }

  clearLogs() {
    this.logs = [];
    this.emit("logs", { logs: this.logs });
  }

  private pushLog(log: ModelLog) {
    this.logs = capLogs([log, ...this.logs]);
    this.emit("log", { log, logs: this.logs });
  }

  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.waiting.length > 0) {
        const batch = this.waiting.splice(0, MAX_BATCH);
        this.queue.inFlight = batch.length;
        this.queue.waiting = this.waiting.length;
        this.emit("queue", this.queue);
        if (!this.evaluator) {
          this.lastError =
            "Set TYPESAFE_API_KEY for live Jev, or TALLY_ALLOW_MOCK=1 for the keyword mock.";
          for (const chat of batch) {
            this.patchLine(chat.id!, (line) => errorLine(line, this.lastError!));
          }
          this.emit("error", { message: this.lastError });
          continue;
        }
        try {
          const result = await ingestChats(this.evaluator, this.polls, batch);
          this.last = {
            model: result.model,
            latencyMs: result.latencyMs,
            questionCount: result.questionCount,
            usage: result.usage,
          };
          this.lastError = null;
          this.inputTokens += Math.max(0, result.usage.input_tokens);
          for (let i = 0; i < result.lines.length; i += 1) {
            const scored = result.lines[i]!;
            const id = batch[i]?.id ?? scored.id;
            scored.id = id;
            this.patchLine(id, () => scored);
            applyLine(this.tallies, this.polls, scored);
          }
          this.emit("score", {
            lines: this.lines,
            tallies: this.tallies,
            last: this.last,
            queue: this.queue,
            inputTokens: this.inputTokens,
          });
        } catch (error) {
          this.lastError = formatEvalError(error);
          for (const chat of batch) {
            this.patchLine(chat.id!, (line) => errorLine(line, this.lastError!));
          }
          this.emit("error", { message: this.lastError });
        }
      }
    } finally {
      this.queue.inFlight = 0;
      this.pumping = false;
      this.emit("queue", this.queue);
    }
  }

  private patchLine(id: string, fn: (line: ScoredLine) => ScoredLine) {
    this.lines = this.lines.map((line) => (line.id === id ? fn(line) : line));
  }

  private emit(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }
}

function sameOptions(tally: Tally, poll: Poll): boolean {
  const keys = Object.keys(tally.hard).sort().join(",");
  const ids = poll.options
    .map((option) => option.id)
    .sort()
    .join(",");
  return keys === ids;
}

function formatEvalError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/model is unavailable/i.test(message) || /\b503\b/.test(message)) {
    return `Jev is temporarily unavailable (${message}). Try scoring again in a moment.`;
  }
  return message;
}
