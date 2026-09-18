import { describe, expect, it } from "vitest";
import { MockEvaluator } from "./mock.ts";
import { LoggingEvaluator } from "./logging.ts";
import type { ModelLog } from "../shared/api.ts";
import type { SystemOneEvaluator } from "./types.ts";

describe("LoggingEvaluator", () => {
  it("records the request and response for a Jev call", async () => {
    const logs: ModelLog[] = [];
    const wrapped = new LoggingEvaluator(new MockEvaluator(), (log) => logs.push(log));
    const questions = {
      "pcatch.m0.pick": {
        type: "choice" as const,
        instructions: "Which option?",
        criteria: { ultra: "Throw a ball", none: "Not a vote" },
      },
    };
    const result = await wrapped.evaluate(
      { chats: [{ author: "a", text: "ultra" }] },
      questions,
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]?.error).toBeNull();
    expect(logs[0]?.request).toEqual({
      state: { chats: [{ author: "a", text: "ultra" }] },
      questions,
    });
    expect(logs[0]?.response).toEqual({ answers: result.answers });
    expect(logs[0]?.questionCount).toBe(1);
  });

  it("records a failed call without dropping the request", async () => {
    const logs: ModelLog[] = [];
    const failing: SystemOneEvaluator = {
      async evaluate() {
        throw new Error("Jev 429");
      },
    };
    const wrapped = new LoggingEvaluator(failing, (log) => logs.push(log));
    await expect(
      wrapped.evaluate({ chats: [] }, {
        "pcatch.m0.on_topic": {
          type: "noul",
          instructions: "On topic?",
          criteria: { true: "yes", false: "no" },
        },
      }),
    ).rejects.toThrow(/429/);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.error).toBe("Jev 429");
    expect(logs[0]?.response).toBeNull();
    expect(logs[0]?.request).toHaveProperty("questions");
  });
});
