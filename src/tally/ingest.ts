import type { SystemOneEvaluator } from "../runtime/types.ts";
import { MAX_BATCH } from "./caps.ts";
import { activePolls, buildQuestions, buildState } from "./questions.ts";
import { scoreChats } from "./score.ts";
import type { IncomingChat, Poll, ScoredLine } from "./types.ts";

export { MAX_BATCH };

export async function ingestChats(
  evaluator: SystemOneEvaluator,
  polls: Poll[],
  chats: IncomingChat[],
): Promise<{
  lines: ScoredLine[];
  questionCount: number;
  model: string;
  latencyMs: number;
  usage: { input_tokens: number; output_tokens: number };
}> {
  if (chats.length === 0) {
    return {
      lines: [],
      questionCount: 0,
      model: "",
      latencyMs: 0,
      usage: { input_tokens: 0, output_tokens: 0 },
    };
  }
  if (chats.length > MAX_BATCH) {
    throw new Error(`Batch too large (max ${MAX_BATCH})`);
  }

  const active = activePolls(polls).filter((poll) => poll.options.length >= 2);
  if (active.length === 0) {
    return {
      lines: scoreChats([], chats, {}),
      questionCount: 0,
      model: "",
      latencyMs: 0,
      usage: { input_tokens: 0, output_tokens: 0 },
    };
  }

  const questions = buildQuestions(active, chats);
  const evaluation = await evaluator.evaluate(buildState(active, chats), questions);
  return {
    lines: scoreChats(active, chats, evaluation.answers),
    questionCount: Object.keys(questions).length,
    model: evaluation.model,
    latencyMs: evaluation.latencyMs,
    usage: evaluation.usage,
  };
}
