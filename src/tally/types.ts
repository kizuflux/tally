export const NONE = "none";

export type PollOption = {
  id: string;
  label: string;
  criterion: string;
};

export type AlertFlag = {
  id: string;
  label: string;
  criterion: string;
  threshold: number;
  enabled: boolean;
};

export type Thresholds = {
  onTopic: number;
  countedConfidence: number;
};

/** Body of a poll (options, flags, bars). */
export type Round = {
  context: string;
  options: PollOption[];
  flags: AlertFlag[];
  thresholds: Thresholds;
};

export type Poll = Round & {
  id: string;
  name: string;
  active: boolean;
  /** When true, off-topic lines add no mass. Off by default: every chat is scored. */
  requireOnTopic: boolean;
};

export type IncomingChat = {
  author: string;
  text: string;
  id?: string;
};

export type ChatLine = {
  id: string;
  at: number;
  author: string;
  text: string;
};

export type LineBucket = "counted" | "leaning" | "not_a_vote";

export type LineStatus = "pending" | "scored" | "error";

export type FlagHit = {
  id: string;
  label: string;
  noul: number;
  alert: boolean;
};

export type PollJudgment = {
  pick: string;
  pickConfidence: number;
  onTopic: number;
  mass: Record<string, number>;
  bucket: LineBucket;
  flags: FlagHit[];
};

export type ScoredLine = ChatLine & {
  status: LineStatus;
  error?: string;
  byPoll: Record<string, PollJudgment>;
};

export type Tally = {
  hard: Record<string, number>;
  mass: Record<string, number>;
  counted: number;
  leaning: number;
  notAVote: number;
  alerts: number;
};

export type QueueStats = {
  waiting: number;
  inFlight: number;
  dropped: number;
  lagging: boolean;
};

export type TwitchStatus = {
  channel: string | null;
  transport: "off" | "irc" | "eventsub";
  connected: boolean;
  oauthReady: boolean;
  oauthConfigured: boolean;
  message: string | null;
};
