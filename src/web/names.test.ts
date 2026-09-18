import { describe, expect, it } from "vitest";
import { authorTag, displayAuthor, displayText, redactLogRequest } from "./names.ts";

describe("displayAuthor", () => {
  it("keeps the real handle when names are shown", () => {
    expect(displayAuthor("TheBausffs", false)).toBe("TheBausffs");
  });

  it("replaces a handle with a stable alias, not the original", () => {
    const hidden = displayAuthor("salty_top", true);
    expect(hidden).toMatch(/^viewer-[0-9a-z]{4}$/);
    expect(hidden).not.toContain("salty");
    expect(hidden).toBe(displayAuthor("salty_top", true));
  });

  it("gives different people different aliases", () => {
    expect(displayAuthor("baller", true)).not.toBe(displayAuthor("nugget", true));
  });

  it("does not collide the empty name with a typical handle", () => {
    expect(authorTag("")).not.toBe(authorTag("viewer"));
  });
});

describe("displayText", () => {
  it("keeps the line as written when names are shown", () => {
    expect(displayText("@okikmai crash the wave", false)).toBe("@okikmai crash the wave");
  });

  it("rewrites @handles with the same aliases as authors", () => {
    const hidden = displayText("@okikmai crash the wave", true);
    expect(hidden).toBe(`@${displayAuthor("okikmai", true)} crash the wave`);
    expect(hidden).not.toContain("okikmai");
  });
});

describe("redactLogRequest", () => {
  const request = {
    state: {
      polls: [{ id: "play", name: "This play" }],
      chats: [
        { author: "ivy", text: "crash the wave" },
        { author: "ivy", text: "gg" },
      ],
    },
    questions: { pick: { type: "choice" } },
  };

  it("leaves the request alone when names are shown", () => {
    expect(redactLogRequest(request, false)).toBe(request);
  });

  it("rewrites chat authors in the logged state and keeps the same alias for repeats", () => {
    const redacted = redactLogRequest(request, true) as typeof request;
    expect(redacted.state.chats[0]?.author).toBe("viewer-" + authorTag("ivy"));
    expect(redacted.state.chats[0]?.author).toBe(redacted.state.chats[1]?.author);
    expect(redacted.state.chats[0]?.text).toBe("crash the wave");
    const mentioned = redactLogRequest(
      {
        state: { chats: [{ author: "a", text: "@ivy gg" }] },
        questions: {},
      },
      true,
    ) as { state: { chats: Array<{ text: string }> } };
    expect(mentioned.state.chats[0]?.text).toBe(`@${displayAuthor("ivy", true)} gg`);
    expect(redacted.questions).toEqual(request.questions);
    expect(request.state.chats[0]?.author).toBe("ivy");
  });
});
