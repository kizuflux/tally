import { TypeSafeClient } from "@typesafe-ai/sdk";
import { MockEvaluator } from "./mock.ts";
import { TypeSafeEvaluator } from "./typesafe.ts";
import type { SystemOneEvaluator } from "./types.ts";

export type EvaluatorMode = "live" | "mock" | "unconfigured";

export function createEvaluator(apiKey = process.env.TYPESAFE_API_KEY): {
  evaluator: SystemOneEvaluator | null;
  mode: EvaluatorMode;
} {
  const key = apiKey?.trim();
  if (key) {
    const client = new TypeSafeClient({
      apiKey: key,
      defaultModel: process.env.TYPESAFE_DEFAULT_MODEL || "jev-latest",
      ...(process.env.TYPESAFE_BASE_URL
        ? { baseURL: process.env.TYPESAFE_BASE_URL }
        : {}),
    });
    return { evaluator: new TypeSafeEvaluator(client), mode: "live" };
  }
  if (process.env.TALLY_ALLOW_MOCK === "1") {
    return { evaluator: new MockEvaluator(), mode: "mock" };
  }
  return { evaluator: null, mode: "unconfigured" };
}
