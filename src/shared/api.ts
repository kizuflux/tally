import type { EvaluatorMode } from "../runtime/client.ts";
import type {
  AlertFlag,
  Poll,
  PollOption,
  QueueStats,
  ScoredLine,
  Tally,
  TwitchStatus,
} from "../tally/types.ts";

export type HealthResponse = {
  ok: boolean;
  mode: EvaluatorMode;
  model: string;
  last: LastEval;
  lastError: string | null;
};

export type LastEval = {
  model: string;
  latencyMs: number;
  questionCount: number;
  usage: { input_tokens: number; output_tokens: number };
} | null;

export type ModelLog = {
  id: string;
  at: number;
  model: string;
  latencyMs: number;
  questionCount: number;
  usage: { input_tokens: number; output_tokens: number };
  request: { state: unknown; questions: unknown };
  response: { answers: unknown } | null;
  error: string | null;
};

export type SessionResponse = {
  polls: Poll[];
  tallies: Record<string, Tally>;
  lines: ScoredLine[];
  seedRemaining: number;
  last: LastEval;
  lastError: string | null;
  mode: EvaluatorMode;
  model: string;
  queue: QueueStats;
  twitch: TwitchStatus;
  logs: ModelLog[];
  inputTokens: number;
};

export type ChatRequest = {
  author?: string;
  text: string;
};

export type { AlertFlag, Poll, PollOption, QueueStats, ScoredLine, Tally, TwitchStatus };
