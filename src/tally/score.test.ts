import { describe, expect, it } from "vitest";
import { MockEvaluator } from "../runtime/mock.ts";
import { ingestChats } from "./ingest.ts";
import { normalizePolls } from "./normalize.ts";
import { buildQuestions } from "./questions.ts";
import { seedPolls, seedQueue } from "./seed.ts";
import {
  addJudgment,
  emptyTally,
  scoreChats,
} from "./score.ts";
import type { Answer } from "../runtime/types.ts";
import type { Poll } from "./types.ts";

const polls = seedPolls();
const catchPoll = polls[0] as Poll;

describe("scoreChats", () => {
  it("drops off-topic lines from the mass when the gate is on", () => {
    const gated = polls.map((poll) =>
      poll.id === "catch" ? { ...poll, requireOnTopic: true } : poll,
    );
    const answers = catchAnswers(0, {
      onTopic: 0.1,
      pick: "ultra",
      confidence: 0.9,
      mass: { ultra: 0.8, swipe: 0.1, run: 0.05, none: 0.05 },
    });
    const [line] = scoreChats(gated, [{ author: "a", text: "gg" }], answers);
    const tally = emptyTally(catchPoll);
    addJudgment(tally, catchPoll, line.byPoll.catch!);
    expect(line.byPoll.catch?.bucket).toBe("not_a_vote");
    expect(tally.mass.ultra).toBe(0);
    expect(tally.notAVote).toBe(1);
  });

  it("covers every line when the on-topic gate is off", () => {
    const answers = catchAnswers(0, {
      onTopic: 0.1,
      pick: "ultra",
      confidence: 0.9,
      mass: { ultra: 0.8, swipe: 0.1, run: 0.05, none: 0.05 },
    });
    const [line] = scoreChats(polls, [{ author: "a", text: "gg" }], answers);
    const tally = emptyTally(catchPoll);
    addJudgment(tally, catchPoll, line.byPoll.catch!);
    expect(line.byPoll.catch?.bucket).toBe("counted");
    expect(tally.mass.ultra).toBeCloseTo(0.8);
    expect(tally.hard.ultra).toBe(1);
  });

  it("adds probability mass and a hard vote when confident", () => {
    const answers = catchAnswers(0, {
      onTopic: 0.9,
      pick: "ultra",
      confidence: 0.8,
      mass: { ultra: 0.7, swipe: 0.2, run: 0.05, none: 0.05 },
    });
    const [line] = scoreChats(
      polls,
      [{ author: "a", text: "ultra the shiny" }],
      answers,
    );
    const tally = emptyTally(catchPoll);
    addJudgment(tally, catchPoll, line.byPoll.catch!);
    expect(line.status).toBe("scored");
    expect(line.byPoll.catch?.bucket).toBe("counted");
    expect(tally.hard.ultra).toBe(1);
    expect(tally.mass.ultra).toBeCloseTo(0.7);
  });

  it("leans without a hard count when confidence is low", () => {
    const answers = catchAnswers(0, {
      onTopic: 0.8,
      pick: "run",
      confidence: 0.3,
      mass: { ultra: 0.3, swipe: 0.3, run: 0.35, none: 0.05 },
    });
    const [line] = scoreChats(polls, [{ author: "a", text: "maybe flee" }], answers);
    const tally = emptyTally(catchPoll);
    addJudgment(tally, catchPoll, line.byPoll.catch!);
    expect(line.byPoll.catch?.bucket).toBe("leaning");
    expect(tally.hard.run).toBe(0);
    expect(tally.mass.run).toBeCloseTo(0.35);
  });

  it("fires a flag when the noul clears the streamer bar", () => {
    const answers = {
      ...catchAnswers(0, {
        onTopic: 0.2,
        pick: "none",
        confidence: 0.4,
        mass: { ultra: 0.1, swipe: 0.1, run: 0.1, none: 0.7 },
      }),
      "pcatch.m0.flag.harassment": noul(0.92),
      "pcatch.m0.flag.backseat": noul(0.1),
    };
    const [line] = scoreChats(
      polls,
      [{ author: "a", text: "streamer is so washed, uninstall" }],
      answers,
    );
    expect(
      line.byPoll.catch?.flags.find((flag) => flag.id === "harassment")?.alert,
    ).toBe(true);
    expect(
      line.byPoll.catch?.flags.find((flag) => flag.id === "backseat")?.alert,
    ).toBe(false);
  });

  it("ignores inactive polls", () => {
    const inactive = polls.map((poll) =>
      poll.id === "bee" ? { ...poll, active: false } : poll,
    );
    const answers = catchAnswers(0, {
      onTopic: 0.9,
      pick: "ultra",
      confidence: 0.9,
      mass: { ultra: 0.9, swipe: 0.05, run: 0.03, none: 0.02 },
    });
    const [line] = scoreChats(
      inactive,
      [{ author: "a", text: "ultra" }],
      answers,
    );
    expect(line.byPoll.catch).toBeTruthy();
    expect(line.byPoll.bee).toBeUndefined();
  });
});

describe("buildQuestions", () => {
  it("omits inactive polls from the Jev question set", () => {
    const inactive = polls.map((poll) =>
      poll.id === "bee" ? { ...poll, active: false } : poll,
    );
    const questions = buildQuestions(inactive, [{ author: "a", text: "ultra" }]);
    expect(Object.keys(questions).some((key) => key.startsWith("pbee."))).toBe(
      false,
    );
    expect(Object.keys(questions)).toContain("pcatch.m0.pick");
  });

  it("fans out per active poll and chat", () => {
    const questions = buildQuestions(polls, [
      { author: "a", text: "ultra" },
      { author: "b", text: "gg" },
    ]);
    expect(Object.keys(questions)).toContain("pcatch.m0.pick");
    expect(Object.keys(questions)).not.toContain("pcatch.m0.on_topic");
    expect(Object.keys(questions)).toContain("pcatch.m1.flag.backseat");
    expect(Object.keys(questions)).toContain("pbee.m0.pick");
    expect(Object.keys(questions)).not.toContain("pbee.m0.flag.backseat");
    const pick = questions["pcatch.m0.pick"];
    expect(pick?.type).toBe("choice");
    if (pick?.type === "choice") expect(pick.criteria.none).toBeTruthy();
  });

  it("adds an on-topic noul only when the poll asks for it", () => {
    const gated = polls.map((poll) =>
      poll.id === "catch" ? { ...poll, requireOnTopic: true } : poll,
    );
    const questions = buildQuestions(gated, [{ author: "a", text: "ultra" }]);
    expect(Object.keys(questions)).toContain("pcatch.m0.on_topic");
    expect(Object.keys(questions)).not.toContain("pbee.m0.on_topic");
  });
});

describe("normalizePolls", () => {
  it("defaults the on-topic gate to off", () => {
    const [poll] = normalizePolls([{ ...catchPoll, requireOnTopic: undefined }]);
    expect(poll?.requireOnTopic).toBe(false);
  });

  it("rejects more than six options", () => {
    const options = Array.from({ length: 7 }, (_, i) => ({
      id: `opt${i}`,
      label: `Option ${i}`,
      criterion: `Choice ${i}`,
    }));
    expect(() => normalizePolls([{ ...catchPoll, options }])).toThrow(/options/);
  });

  it("rejects a sixth active poll", () => {
    const extras = Array.from({ length: 4 }, (_, i) => ({
      ...polls[1],
      id: `extra${i}`,
      name: `Extra ${i}`,
      active: true,
    }));
    expect(() => normalizePolls([...polls, ...extras])).toThrow(/active polls/);
  });
});

describe("mock ingest", () => {
  it("counts a catch vote and ignores gg", async () => {
    const evaluator = new MockEvaluator();
    const voted = await ingestChats(evaluator, polls, [seedQueue()[0]!]);
    const chatter = await ingestChats(evaluator, polls, [seedQueue()[1]!]);
    expect(voted.lines[0]?.byPoll.catch?.bucket).not.toBe("not_a_vote");
    expect(voted.lines[0]?.byPoll.catch?.pick).toBe("ultra");
    expect(chatter.lines[0]?.byPoll.catch?.bucket).toBe("not_a_vote");
  });
});

function noul(value: number): Answer {
  return { type: "noul", noul: value };
}

function catchAnswers(
  i: number,
  spec: {
    onTopic: number;
    pick: string;
    confidence: number;
    mass: Record<string, number>;
  },
): Record<string, Answer> {
  return {
    [`pcatch.m${i}.on_topic`]: noul(spec.onTopic),
    [`pcatch.m${i}.pick`]: {
      type: "choice",
      choice: spec.pick,
      confidence: spec.confidence,
      probabilities: spec.mass,
    },
    [`pcatch.m${i}.flag.backseat`]: noul(0.05),
    [`pcatch.m${i}.flag.harassment`]: noul(0.05),
  };
}
