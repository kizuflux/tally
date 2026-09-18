import type { Answer, ChoiceAnswer, NoulAnswer } from "../runtime/types.ts";
import { flagKey, onTopicKey, pickKey } from "./ids.ts";
import { activePolls } from "./questions.ts";
import {
  NONE,
  type IncomingChat,
  type Poll,
  type PollJudgment,
  type ScoredLine,
  type Tally,
} from "./types.ts";

export function emptyTally(poll: Poll): Tally {
  const zeros = Object.fromEntries(poll.options.map((option) => [option.id, 0]));
  return {
    hard: { ...zeros },
    mass: { ...zeros },
    counted: 0,
    leaning: 0,
    notAVote: 0,
    alerts: 0,
  };
}

export function emptyTallies(polls: Poll[]): Record<string, Tally> {
  return Object.fromEntries(polls.map((poll) => [poll.id, emptyTally(poll)]));
}

export function pendingLine(chat: IncomingChat, at = Date.now()): ScoredLine {
  return {
    id: chat.id ?? crypto.randomUUID(),
    at,
    author: chat.author,
    text: chat.text,
    status: "pending",
    byPoll: {},
  };
}

export function errorLine(line: ScoredLine, message: string): ScoredLine {
  return { ...line, status: "error", error: message };
}

export function scoreChats(
  polls: Poll[],
  chats: IncomingChat[],
  answers: Record<string, Answer>,
  at = Date.now(),
): ScoredLine[] {
  const active = activePolls(polls);
  return chats.map((chat, i) => {
    const byPoll: Record<string, PollJudgment> = {};
    for (const poll of active) {
      byPoll[poll.id] = judgePoll(poll, answers, i);
    }
    return {
      id: chat.id ?? crypto.randomUUID(),
      at: at + i,
      author: chat.author,
      text: chat.text,
      status: "scored",
      byPoll,
    };
  });
}

export function addJudgment(tally: Tally, poll: Poll, judgment: PollJudgment): void {
  if (judgment.bucket === "not_a_vote") {
    tally.notAVote += 1;
  } else if (judgment.bucket === "leaning") {
    tally.leaning += 1;
    addMass(tally, poll, judgment);
  } else {
    tally.counted += 1;
    addMass(tally, poll, judgment);
    if (judgment.pick !== NONE && judgment.pick in tally.hard) {
      tally.hard[judgment.pick] = (tally.hard[judgment.pick] ?? 0) + 1;
    }
  }
  if (judgment.flags.some((flag) => flag.alert)) tally.alerts += 1;
}

export function applyLine(
  tallies: Record<string, Tally>,
  polls: Poll[],
  line: ScoredLine,
): void {
  if (line.status !== "scored") return;
  for (const poll of polls) {
    const judgment = line.byPoll[poll.id];
    const tally = tallies[poll.id];
    if (!judgment || !tally) continue;
    addJudgment(tally, poll, judgment);
  }
}

function addMass(tally: Tally, poll: Poll, judgment: PollJudgment): void {
  for (const option of poll.options) {
    tally.mass[option.id] =
      (tally.mass[option.id] ?? 0) + (judgment.mass[option.id] ?? 0);
  }
}

function judgePoll(
  poll: Poll,
  answers: Record<string, Answer>,
  i: number,
): PollJudgment {
  const onTopic = poll.requireOnTopic
    ? noulOf(answers[onTopicKey(poll.id, i)])
    : 1;
  const pick = choiceOf(answers[pickKey(poll.id, i)], poll);
  const enabledFlags = poll.flags.filter((flag) => flag.enabled);
  const flags = enabledFlags.map((flag) => {
    const noul = noulOf(answers[flagKey(poll.id, i, flag.id)]);
    return {
      id: flag.id,
      label: flag.label,
      noul,
      alert: noul >= flag.threshold,
    };
  });
  const mass: Record<string, number> = {};
  for (const option of poll.options) {
    mass[option.id] = pick.probabilities[option.id] ?? 0;
  }
  let bucket: PollJudgment["bucket"] = "not_a_vote";
  const onTopicOk = !poll.requireOnTopic || onTopic >= poll.thresholds.onTopic;
  if (onTopicOk && pick.choice !== NONE) {
    bucket =
      pick.confidence >= poll.thresholds.countedConfidence
        ? "counted"
        : "leaning";
  }
  return {
    pick: pick.choice,
    pickConfidence: pick.confidence,
    onTopic,
    mass,
    bucket,
    flags,
  };
}

function noulOf(answer: Answer | undefined): number {
  if (answer?.type === "noul") return (answer as NoulAnswer).noul;
  return 0;
}

function choiceOf(
  answer: Answer | undefined,
  poll: Poll,
): { choice: string; confidence: number; probabilities: Record<string, number> } {
  if (answer?.type === "choice") {
    const picked = answer as ChoiceAnswer;
    return {
      choice: picked.choice,
      confidence: picked.confidence,
      probabilities: picked.probabilities,
    };
  }
  const probabilities = Object.fromEntries([
    ...poll.options.map((option) => [option.id, 0] as const),
    [NONE, 1] as const,
  ]);
  return { choice: NONE, confidence: 0, probabilities };
}
