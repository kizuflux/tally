import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { seedPolls } from "./seed.ts";
import { loadPolls, savePolls } from "./store.ts";

describe("store", () => {
  it("round-trips polls to disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tally-"));
    const path = join(dir, "tally.json");
    const polls = seedPolls();
    await savePolls(polls, path);
    const loaded = await loadPolls(path);
    expect(loaded.map((poll) => poll.id)).toEqual(["catch", "bee"]);
    expect(loaded[0]?.options).toHaveLength(3);
    await rm(dir, { recursive: true, force: true });
  });

  it("seeds when the file is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tally-"));
    const loaded = await loadPolls(join(dir, "missing.json"));
    expect(loaded.map((poll) => poll.id)).toEqual(["catch", "bee"]);
    await rm(dir, { recursive: true, force: true });
  });
});
