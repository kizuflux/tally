import { choice, noul, score, TypeSafeClient } from "@typesafe-ai/sdk";
import { confidenceFromDistribution } from "./math.ts";
import type {
  Answer,
  Question,
  SystemOneEvaluator,
  SystemOneResult,
} from "./types.ts";

type SdkQuestions = Record<
  string,
  ReturnType<typeof choice> | ReturnType<typeof noul> | ReturnType<typeof score>
>;

export class TypeSafeEvaluator implements SystemOneEvaluator {
  private readonly client: TypeSafeClient;

  constructor(client: TypeSafeClient) {
    this.client = client;
  }

  async evaluate(
    state: unknown,
    questions: Record<string, Question>,
  ): Promise<SystemOneResult> {
    const started = Date.now();
    const sdkQuestions: SdkQuestions = {};
    for (const [key, question] of Object.entries(questions)) {
      sdkQuestions[key] = toSdkQuestion(question);
    }
    const response = await withRetry(() =>
      this.client.systemOne({
        state: state as never,
        questions: sdkQuestions,
      }),
    );
    const answers: Record<string, Answer> = {};
    for (const [key, question] of Object.entries(questions)) {
      answers[key] = fromSdkAnswer(question, response.answers[key]);
    }
    return {
      model: response.model ?? "jev-latest",
      answers,
      usage: {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
      },
      latencyMs: Date.now() - started,
    };
  }
}

function toSdkQuestion(question: Question) {
  if (question.type === "choice") {
    return choice(question.instructions, question.criteria);
  }
  if (question.type === "score") {
    const criteria = question.criteria;
    if (criteria.length < 2) {
      throw new Error("Score questions need at least two levels");
    }
    return score(question.instructions, criteria as [string, string, ...string[]]);
  }
  return noul(question.instructions, question.criteria ?? null);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (!isUnavailable(error) || i === attempts - 1) throw error;
      await sleep(400 * 2 ** i);
    }
  }
  throw last;
}

function isUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b503\b/.test(message) || /model is unavailable/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fromSdkAnswer(question: Question, raw: unknown): Answer {
  if (question.type === "noul") {
    const noulValue = numberField(raw, "noul");
    return { type: "noul", noul: noulValue };
  }
  if (question.type === "choice") {
    const probabilities = numberRecord(raw, "probabilities");
    const picked =
      stringField(raw, "choice") ||
      Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "";
    const confidence =
      optionalNumberField(raw, "confidence") ??
      confidenceFromDistribution(probabilities);
    return {
      type: "choice",
      choice: picked,
      probabilities,
      confidence,
    };
  }
  const probabilities = numberRecord(raw, "probabilities");
  const legend = stringRecord(raw, "legend");
  const confidence =
    optionalNumberField(raw, "confidence") ??
    confidenceFromDistribution(probabilities);
  return {
    type: "score",
    score: numberField(raw, "score"),
    legend,
    probabilities,
    confidence,
  };
}

function numberField(raw: unknown, key: string): number {
  if (raw && typeof raw === "object" && key in raw) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "number") return value;
  }
  throw new Error(`Missing numeric field ${key}`);
}

function optionalNumberField(raw: unknown, key: string): number | undefined {
  if (raw && typeof raw === "object" && key in raw) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "number") return value;
  }
  return undefined;
}

function stringField(raw: unknown, key: string): string {
  if (raw && typeof raw === "object" && key in raw) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return "";
}

function numberRecord(raw: unknown, key: string): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw && typeof raw === "object" && key in raw) {
    const value = (raw as Record<string, unknown>)[key];
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (typeof v === "number") out[k] = v;
      }
    }
  }
  return out;
}

function stringRecord(raw: unknown, key: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object" && key in raw) {
    const value = (raw as Record<string, unknown>)[key];
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = String(v);
      }
    }
  }
  return out;
}
