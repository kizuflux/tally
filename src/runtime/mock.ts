import {
  argmax,
  clamp01,
  confidenceFromDistribution,
  softmax,
} from "./math.ts";
import { tokenize } from "./tokens.ts";
import type {
  Answer,
  Question,
  SystemOneEvaluator,
  SystemOneResult,
} from "./types.ts";

/**
 * Deterministic stand-in when TYPESAFE_API_KEY is missing.
 * Keyword overlap is not Jev — it only unblocks local UI and tests.
 */
export class MockEvaluator implements SystemOneEvaluator {
  async evaluate(
    state: unknown,
    questions: Record<string, Question>,
  ): Promise<SystemOneResult> {
    const started = Date.now();
    const chats = chatsOf(state);
    const blob = flattenState(state);
    const answers: Record<string, Answer> = {};
    for (const [key, question] of Object.entries(questions)) {
      answers[key] = mockQuestion(key, question, chats, blob);
    }
    return {
      model: "mock-jev",
      answers,
      usage: {
        input_tokens: Math.max(32, Math.round(blob.length / 4)),
        output_tokens: Object.keys(questions).length * 4,
      },
      latencyMs: Date.now() - started,
    };
  }
}

function mockQuestion(
  key: string,
  question: Question,
  chats: string[],
  blob: string,
): Answer {
  const text = textForKey(key, chats, blob);
  if (question.type === "noul") {
    return { type: "noul", noul: mockNoul(key, question, text) };
  }
  if (question.type === "score") {
    const scores: Record<string, number> = {};
    for (const [i, level] of question.criteria.entries()) {
      scores[String(i)] = overlap(text, level) + i * 0.04;
    }
    const probabilities = softmax(scores);
    const score = Object.entries(probabilities).reduce(
      (sum, [k, p]) => sum + Number(k) * p,
      0,
    );
    return {
      type: "score",
      score,
      legend: Object.fromEntries(
        question.criteria.map((level, i) => [String(i), level]),
      ),
      probabilities,
      confidence: confidenceFromDistribution(probabilities),
    };
  }

  const scores: Record<string, number> = {};
  for (const [option, description] of Object.entries(question.criteria)) {
    scores[option] =
      overlap(text, `${option} ${description}`) +
      (option === "none" ? noneBias(text, question.criteria) : 0.08);
    if (text.includes(option.toLowerCase())) scores[option] += 1.2;
  }
  const probabilities = softmax(scores);
  return {
    type: "choice",
    choice: argmax(probabilities),
    probabilities,
    confidence: confidenceFromDistribution(probabilities),
  };
}

function mockNoul(
  key: string,
  question: Question,
  text: string,
): number {
  if (key.endsWith(".on_topic")) {
    const chatter = /^(gg|lul|kappa|pog|hello|hi|hey)\b/.test(text.trim());
    const vote = overlap(
      text,
      "ultra swipe run catch ball throw shiny left sparkly yellow flee flee flee",
    );
    if (chatter && vote < 0.15) return 0.08;
    return clamp01(
      0.12 +
        vote * 2.4 +
        (/\b(ball|throw|swipe|run|catch|ultra|shiny|sparkly)\b/.test(text)
          ? 0.45
          : 0),
    );
  }
  const trueText =
    question.type === "noul"
      ? `${question.instructions} ${question.criteria?.true ?? ""}`
      : "";
  let n = overlap(text, trueText) * 1.6;
  if (key.includes("backseat") && /noob|have to|git gud|throwing/.test(text)) n += 0.7;
  if (key.includes("harassment") && /washed|uninstall|trash|idiot|kill yourself/.test(text)) {
    n += 0.85;
  }
  if (key.includes("spoiler") && /ending|dlc|later/.test(text)) n += 0.6;
  return clamp01(n);
}

function noneBias(text: string, criteria: Record<string, string>): number {
  const others = Object.entries(criteria)
    .filter(([id]) => id !== "none")
    .map(([, description]) => overlap(text, description));
  const best = others.length ? Math.max(...others) : 0;
  return best < 0.12 ? 1.6 : 0.02;
}

function overlap(blob: string, text: string): number {
  const words = tokenize(text);
  if (words.length === 0) return 0;
  let hit = 0;
  for (const word of words) if (blob.includes(word)) hit += 1;
  return hit / words.length;
}

function textForKey(key: string, chats: string[], blob: string): string {
  const match = /(?:^|[.])m(\d+)\./.exec(key);
  if (match) {
    const chat = chats[Number(match[1])];
    if (chat) return chat;
  }
  return blob;
}

function chatsOf(state: unknown): string[] {
  if (state && typeof state === "object" && "chats" in state) {
    const chats = (state as { chats: unknown }).chats;
    if (Array.isArray(chats)) {
      return chats.map((chat) => {
        if (chat && typeof chat === "object" && "text" in chat) {
          return String((chat as { text: unknown }).text).toLowerCase();
        }
        return String(chat).toLowerCase();
      });
    }
  }
  return [];
}

function flattenState(state: unknown): string {
  if (typeof state === "string") return state.toLowerCase();
  try {
    return JSON.stringify(state).toLowerCase();
  } catch {
    return String(state).toLowerCase();
  }
}
