import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { normalizePolls } from "./normalize.ts";
import { seedPolls } from "./seed.ts";
import type { Poll } from "./types.ts";

export function dataPath(file = "tally.json"): string {
  return join(process.cwd(), "data", file);
}

export async function loadPolls(path = dataPath()): Promise<Poll[]> {
  try {
    const raw = await readFile(path, "utf8");
    return normalizePolls(JSON.parse(raw).polls);
  } catch (error) {
    if (isMissing(error)) return seedPolls();
    throw error;
  }
}

export async function savePolls(
  polls: Poll[],
  path = dataPath(),
): Promise<void> {
  const normalized = normalizePolls(polls);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify({ polls: normalized }, null, 2)}\n`,
    "utf8",
  );
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "ENOENT"
  );
}
