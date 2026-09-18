import { afterEach, describe, expect, it } from "vitest";
import { createEvaluator } from "./client.ts";

describe("createEvaluator", () => {
  const prevKey = process.env.TYPESAFE_API_KEY;
  const prevMock = process.env.TALLY_ALLOW_MOCK;

  afterEach(() => {
    restore("TYPESAFE_API_KEY", prevKey);
    restore("TALLY_ALLOW_MOCK", prevMock);
  });

  it("uses live Jev when a key is present", () => {
    process.env.TALLY_ALLOW_MOCK = "1";
    expect(createEvaluator("ts_test_key").mode).toBe("live");
  });

  it("uses the mock only when explicitly allowed", () => {
    delete process.env.TYPESAFE_API_KEY;
    process.env.TALLY_ALLOW_MOCK = "1";
    expect(createEvaluator("").mode).toBe("mock");
  });

  it("stays unconfigured without a key or mock flag", () => {
    delete process.env.TYPESAFE_API_KEY;
    delete process.env.TALLY_ALLOW_MOCK;
    expect(createEvaluator("").mode).toBe("unconfigured");
    expect(createEvaluator("").evaluator).toBeNull();
  });
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
