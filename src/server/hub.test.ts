import { describe, expect, it } from "vitest";
import { MockEvaluator } from "../runtime/mock.ts";
import { emptyTallies } from "../tally/score.ts";
import { seedPolls } from "../tally/seed.ts";
import { TallyHub } from "./hub.ts";

describe("TallyHub input token tally", () => {
  it("starts at zero and adds each scored batch", async () => {
    const hub = new TallyHub(new MockEvaluator(), "mock", "mock-jev");
    hub.polls = seedPolls();
    hub.tallies = emptyTallies(hub.polls);
    expect(hub.snapshot().inputTokens).toBe(0);

    hub.enqueue({ author: "a", text: "ultra the shiny on the left" });
    await waitForTokens(hub, (total) => total > 0);
    const first = hub.snapshot().inputTokens;

    hub.enqueue({ author: "b", text: "false swipe first so you don't kill it" });
    await waitForTokens(hub, (total) => total > first);
    expect(hub.snapshot().last?.usage.input_tokens).toBeGreaterThan(0);
    expect(hub.snapshot().inputTokens).toBe(
      first + (hub.snapshot().last?.usage.input_tokens ?? 0),
    );
  });

  it("keeps the token tally when the chat feed is reset", async () => {
    const hub = new TallyHub(new MockEvaluator(), "mock", "mock-jev");
    hub.polls = seedPolls();
    hub.tallies = emptyTallies(hub.polls);
    hub.enqueue({ author: "a", text: "ultra the shiny on the left" });
    await waitForTokens(hub, (total) => total > 0);
    const consumed = hub.snapshot().inputTokens;
    hub.resetSession();
    expect(hub.snapshot().inputTokens).toBe(consumed);
    expect(hub.snapshot().lines).toEqual([]);
  });
});

async function waitForTokens(
  hub: TallyHub,
  ready: (total: number) => boolean,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (ready(hub.snapshot().inputTokens)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`timed out waiting for input tokens (have ${hub.snapshot().inputTokens})`);
}
