export type Question =
  | {
      type: "choice";
      instructions: string;
      criteria: Record<string, string>;
    }
  | {
      type: "score";
      instructions: string;
      criteria: string[];
    }
  | {
      type: "noul";
      instructions: string;
      criteria?: { true?: string; false?: string };
    };

export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

export type ScoreAnswer = {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
};

export type NoulAnswer = {
  type: "noul";
  noul: number;
};

export type Answer = ChoiceAnswer | ScoreAnswer | NoulAnswer;

export type SystemOneResult = {
  model: string;
  answers: Record<string, Answer>;
  usage: { input_tokens: number; output_tokens: number };
  latencyMs: number;
};

export interface SystemOneEvaluator {
  evaluate(
    state: unknown,
    questions: Record<string, Question>,
  ): Promise<SystemOneResult>;
}
