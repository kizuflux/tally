export function onTopicKey(pollId: string, i: number): string {
  return `p${pollId}.m${i}.on_topic`;
}

export function pickKey(pollId: string, i: number): string {
  return `p${pollId}.m${i}.pick`;
}

export function flagKey(pollId: string, i: number, flagId: string): string {
  return `p${pollId}.m${i}.flag.${flagId}`;
}

export function messageIndex(key: string): number | null {
  const match = /(?:^|[.])m(\d+)\./.exec(key);
  return match ? Number(match[1]) : null;
}
