import { MAX_LOGS } from "../tally/caps.ts";
import type { ModelLog } from "../shared/api.ts";
import type { Question, SystemOneEvaluator, SystemOneResult } from "./types.ts";

export class LoggingEvaluator implements SystemOneEvaluator {
  constructor(
    private readonly inner: SystemOneEvaluator,
    private readonly onLog: (log: ModelLog) => void,
  ) {}

  async evaluate(
    state: unknown,
    questions: Record<string, Question>,
  ): Promise<SystemOneResult> {
    const started = Date.now();
    const request = clone({ state, questions });
    try {
      const result = await this.inner.evaluate(state, questions);
      this.onLog({
        id: crypto.randomUUID(),
        at: started,
        model: result.model,
        latencyMs: result.latencyMs,
        questionCount: Object.keys(questions).length,
        usage: result.usage,
        request,
        response: clone({ answers: result.answers }),
        error: null,
      });
      return result;
    } catch (error) {
      this.onLog({
        id: crypto.randomUUID(),
        at: started,
        model: "",
        latencyMs: Date.now() - started,
        questionCount: Object.keys(questions).length,
        usage: { input_tokens: 0, output_tokens: 0 },
        request,
        response: null,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export function capLogs(logs: ModelLog[]): ModelLog[] {
  return logs.slice(0, MAX_LOGS);
}

function clone<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}
