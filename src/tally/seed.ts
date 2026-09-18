import type { IncomingChat, Poll } from "./types.ts";

export function seedPolls(): Poll[] {
  return [
    {
      id: "catch",
      name: "Catch the shiny",
      active: true,
      requireOnTopic: false,
      context:
        "Wild encounter. The creature on the left is a shiny Pikachu. The one on the right is a Beedrill. The streamer is trying to catch the shiny and not start a fight with the bee.",
      options: [
        {
          id: "ultra",
          label: "Ultra Ball",
          criterion:
            "Throw a ball — especially an Ultra Ball — at the shiny Pikachu on the left, to catch it now.",
        },
        {
          id: "swipe",
          label: "False swipe",
          criterion:
            "Weaken the shiny first with False Swipe or a similar non-KO move. Do not catch yet and do not attack the Beedrill.",
        },
        {
          id: "run",
          label: "Run",
          criterion: "Flee or run from this encounter without catching or fighting.",
        },
      ],
      flags: [
        {
          id: "backseat",
          label: "Backseating",
          criterion:
            "The chatter is barking the 'correct' play as an order or insult, not merely casting a vote.",
          threshold: 0.78,
          enabled: true,
        },
        {
          id: "harassment",
          label: "Harassment",
          criterion:
            "Targeted insult, slur, or attack aimed at the streamer or another person — not trash talk about the game.",
          threshold: 0.8,
          enabled: true,
        },
      ],
      thresholds: {
        onTopic: 0.55,
        countedConfidence: 0.5,
      },
    },
    {
      id: "bee",
      name: "The bee",
      active: true,
      requireOnTopic: false,
      context:
        "Same wild encounter. Independently of catching the shiny: should the streamer engage the Beedrill on the right?",
      options: [
        {
          id: "ignore",
          label: "Ignore the bee",
          criterion:
            "Do not fight or target the Beedrill. Leave it alone and focus on the shiny.",
        },
        {
          id: "fight",
          label: "Fight the bee",
          criterion:
            "Attack, KO, or otherwise engage the Beedrill on the right.",
        },
      ],
      flags: [],
      thresholds: {
        onTopic: 0.55,
        countedConfidence: 0.5,
      },
    },
  ];
}

export function seedQueue(): IncomingChat[] {
  return [
    { author: "baller", text: "ultra the shiny on the left" },
    { author: "nugget", text: "gg" },
    { author: "ivy", text: "false swipe first so you don't kill it" },
    { author: "peli", text: "the sparkly one, just ball it" },
    { author: "mod_jen", text: "what game is this" },
    { author: "bee", text: "run you cannot risk the bee" },
    { author: "kappa", text: "Kappa" },
    { author: "coach", text: "you have to false swipe or you are throwing noob" },
    { author: "ash", text: "yellow rat, ultra now" },
    { author: "salt", text: "streamer is so washed, uninstall" },
    { author: "mia", text: "don't fight the bee, throw the ultra" },
    { author: "lulu", text: "LUL" },
  ];
}

export function blankPoll(existing: string[]): Poll {
  const id = newPollId(existing);
  return {
    id,
    name: "New poll",
    active: false,
    requireOnTopic: false,
    context: "What is chat deciding right now?",
    options: [
      {
        id: "opt1",
        label: "Option A",
        criterion: "The first choice in the current situation.",
      },
      {
        id: "opt2",
        label: "Option B",
        criterion: "The second choice in the current situation.",
      },
    ],
    flags: [],
    thresholds: { onTopic: 0.55, countedConfidence: 0.5 },
  };
}

export function newPollId(existing: string[]): string {
  return nextId("poll", existing);
}

export function newOptionId(existing: string[]): string {
  return nextId("opt", existing);
}

export function newFlagId(existing: string[]): string {
  return nextId("flag", existing);
}

function nextId(prefix: string, existing: string[]): string {
  let n = existing.length + 1;
  let id = `${prefix}${n}`;
  while (existing.includes(id)) {
    n += 1;
    id = `${prefix}${n}`;
  }
  return id;
}
