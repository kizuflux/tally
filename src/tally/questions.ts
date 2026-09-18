import type { Question } from "../runtime/types.ts";
import { flagKey, onTopicKey, pickKey } from "./ids.ts";
import { NONE, type IncomingChat, type Poll } from "./types.ts";

export type TallyStatePayload = {
  polls: Array<{
    id: string;
    name: string;
    context: string;
    options: Poll["options"];
    flags: Array<Pick<Poll["flags"][number], "id" | "label" | "criterion">>;
  }>;
  chats: Array<{ author: string; text: string }>;
};

export function activePolls(polls: Poll[]): Poll[] {
  return polls.filter((poll) => poll.active);
}

export function buildState(polls: Poll[], chats: IncomingChat[]): TallyStatePayload {
  const active = activePolls(polls);
  return {
    polls: active.map((poll) => ({
      id: poll.id,
      name: poll.name,
      context: poll.context,
      options: poll.options,
      flags: poll.flags
        .filter((flag) => flag.enabled)
        .map(({ id, label, criterion }) => ({ id, label, criterion })),
    })),
    chats: chats.map(({ author, text }) => ({ author, text })),
  };
}

export function buildQuestions(
  polls: Poll[],
  chats: IncomingChat[],
): Record<string, Question> {
  const questions: Record<string, Question> = {};
  const active = activePolls(polls);

  for (const poll of active) {
    const pollPath = pollStatePath(poll.id);
    const enabledFlags = poll.flags.filter((flag) => flag.enabled);
    const pickCriteria: Record<string, string> = {
      ...Object.fromEntries(
        poll.options.map((option) => [option.id, option.criterion]),
      ),
      [NONE]: "The message does not choose among this poll's options.",
    };

    for (let i = 0; i < chats.length; i += 1) {
      const path = `chats[${i}].text`;
      if (poll.requireOnTopic) {
        questions[onTopicKey(poll.id, i)] = {
          type: "noul",
          instructions: `Does \`${path}\` take a side on poll \`${pollPath}.name\` (${poll.name}) given \`${pollPath}.context\`? True if it is a vote, preference, or instruction among that poll's options. False if it is a greeting, emote, copypasta, a question to the streamer, or unrelated to this poll.`,
          criteria: {
            true: "A preference or instruction among this poll's options",
            false: "Not a vote on this poll",
          },
        };
      }
      questions[pickKey(poll.id, i)] = {
        type: "choice",
        instructions: `Which option of poll \`${pollPath}.name\` does \`${path}\` support, given \`${pollPath}.context\`? Use ${NONE} if the message does not choose among these options.`,
        criteria: pickCriteria,
      };
      for (const flag of enabledFlags) {
        questions[flagKey(poll.id, i, flag.id)] = {
          type: "noul",
          instructions: `Does \`${path}\` match this streamer alert on poll \`${pollPath}.name\` — ${flag.label}: ${flag.criterion} — given \`${pollPath}.context\`? Mentions, jokes about the rule, or quoting someone else are false.`,
          criteria: {
            true: flag.criterion,
            false: "The message does not do that",
          },
        };
      }
    }
  }

  return questions;
}

function pollStatePath(pollId: string): string {
  return `polls[id=${pollId}]`;
}
