export function softmax(scores: Record<string, number>): Record<string, number> {
  const keys = Object.keys(scores);
  if (keys.length === 0) return {};
  const max = Math.max(...keys.map((k) => scores[k] ?? 0));
  const exps: Record<string, number> = {};
  let sum = 0;
  for (const k of keys) {
    const v = Math.exp((scores[k] ?? 0) - max);
    exps[k] = v;
    sum += v;
  }
  return Object.fromEntries(keys.map((k) => [k, (exps[k] ?? 0) / sum]));
}

/** Map a peaked distribution to 0–1 confidence. Flat → ~0. */
export function confidenceFromDistribution(
  probabilities: Record<string, number>,
): number {
  const values = Object.values(probabilities).sort((a, b) => b - a);
  if (values.length === 0) return 0;
  const top = values[0] ?? 0;
  const second = values[1] ?? 0;
  const n = values.length;
  const uniform = 1 / n;
  const peaked = Math.max(0, (top - uniform) / (1 - uniform));
  const gap = Math.max(0, top - second);
  return clamp01(0.55 * peaked + 0.45 * gap);
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function argmax(probabilities: Record<string, number>): string {
  let best = "";
  let bestP = -1;
  for (const [k, v] of Object.entries(probabilities)) {
    if (v > bestP) {
      best = k;
      bestP = v;
    }
  }
  return best;
}
