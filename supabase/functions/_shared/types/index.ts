export type TokenUsage = {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
};

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GeneratedRecipe = {
  need_clarification: boolean;
  question: string;
  options: string[];
  can_help: boolean;
  title: string;
  category: string;
  ingredients: string;
  instructions: string;
  reply_text: string;
  usage: TokenUsage;
};

export type ClientSettings = {
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
};
