import { MAX_ACTIVE_POLLS, MAX_ENABLED_FLAGS, MAX_OPTIONS } from "./caps.ts";
import { newFlagId, newOptionId, newPollId } from "./seed.ts";
import type { AlertFlag, Poll, PollOption, Thresholds } from "./types.ts";

export function normalizePoll(input: unknown, existingIds: string[] = []): Poll {
  if (!input || typeof input !== "object") {
    throw new Error("poll is required");
  }
  const raw = input as Partial<Poll>;
  const context = String(raw.context ?? "").trim();
  if (!context) throw new Error("context is required");

  const options = (raw.options ?? [])
    .map(cleanOption)
    .filter((option) => option.label);
  if (options.length < 2) throw new Error("Need at least two options");
  if (options.length > MAX_OPTIONS) {
    throw new Error(`At most ${MAX_OPTIONS} options per poll`);
  }
  const seen = new Set<string>();
  for (const option of options) {
    if (seen.has(option.id) || option.id === "none") {
      option.id = newOptionId([...seen]);
    }
    seen.add(option.id);
  }

  const flags = (raw.flags ?? []).map(cleanFlag);
  const flagIds = new Set<string>();
  for (const flag of flags) {
    if (flagIds.has(flag.id)) flag.id = newFlagId([...flagIds]);
    flagIds.add(flag.id);
  }
  const enabledFlags = flags.filter((flag) => flag.enabled).length;
  if (enabledFlags > MAX_ENABLED_FLAGS) {
    throw new Error(`At most ${MAX_ENABLED_FLAGS} enabled alert flags per poll`);
  }

  const name = String(raw.name ?? "").trim() || "Untitled poll";
  let id = slug(String(raw.id ?? ""), "");
  if (!id || existingIds.includes(id)) {
    id = newPollId(existingIds);
  }

  return {
    id,
    name,
    active: raw.active !== false,
    requireOnTopic: raw.requireOnTopic === true,
    context,
    options,
    flags,
    thresholds: cleanThresholds(raw.thresholds),
  };
}

export function normalizePolls(input: unknown): Poll[] {
  if (!Array.isArray(input)) throw new Error("polls must be an array");
  const polls: Poll[] = [];
  const ids: string[] = [];
  for (const item of input) {
    const poll = normalizePoll(item, ids);
    ids.push(poll.id);
    polls.push(poll);
  }
  const active = polls.filter((poll) => poll.active).length;
  if (active > MAX_ACTIVE_POLLS) {
    throw new Error(`At most ${MAX_ACTIVE_POLLS} active polls`);
  }
  return polls;
}

function cleanOption(raw: Partial<PollOption>, index: number): PollOption {
  const label = String(raw.label ?? "").trim();
  return {
    id: slug(String(raw.id ?? `opt${index + 1}`), `opt${index + 1}`),
    label,
    criterion: String(raw.criterion ?? label).trim() || label,
  };
}

function cleanFlag(raw: Partial<AlertFlag>, index: number): AlertFlag {
  const label = String(raw.label ?? "").trim() || `Alert ${index + 1}`;
  return {
    id: slug(String(raw.id ?? `flag${index + 1}`), `flag${index + 1}`),
    label,
    criterion: String(raw.criterion ?? "").trim() || label,
    threshold: clamp01(Number(raw.threshold ?? 0.78)),
    enabled: raw.enabled !== false,
  };
}

function cleanThresholds(raw: Partial<Thresholds> | undefined): Thresholds {
  return {
    onTopic: clamp01(Number(raw?.onTopic ?? 0.55)),
    countedConfidence: clamp01(Number(raw?.countedConfidence ?? 0.5)),
  };
}

function slug(value: string, fallback: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9_]+/g, "");
  return cleaned || fallback;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}
