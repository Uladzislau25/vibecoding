export type TokenUsage = {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
};

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type RecipeNutrition = {
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  cook_time: string | null;
  servings: number | null;
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
  nutrition: RecipeNutrition;
  usage: TokenUsage;
};

export type ClientSettings = {
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
};
