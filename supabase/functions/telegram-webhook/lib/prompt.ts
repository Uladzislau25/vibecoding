export function buildSystemPrompt(basePrompt: string, dietaryNotes: string | null): string {
  if (!dietaryNotes) return basePrompt;
  return `${basePrompt}\n\nПользователь указал предпочтения: ${dietaryNotes}. Всегда учитывай это при составлении рецептов.`;
}

export function withServings(systemPrompt: string, servings: number | null): string {
  if (!servings) return systemPrompt;
  return `${systemPrompt}\n\nПользователь хочет рецепт на ${servings} порций.`;
}

export type FormatRecipeInput = {
  title: string;
  ingredients: string;
  instructions: string;
  calories?: number | null;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  cook_time?: string | null;
  servings?: number | null;
};

export function formatRecipe(r: FormatRecipeInput): string {
  const parts = [
    `🍽️ ${r.title}`,
    "",
    "🛒 Ингредиенты:",
    r.ingredients,
    "",
    "👨‍🍳 Приготовление:",
    r.instructions,
  ];

  const meta: string[] = [];
  if (r.cook_time) meta.push(`⏱️ Время приготовления: ${r.cook_time}`);
  if (r.servings) meta.push(`🍽️ Порций: ${r.servings}`);
  if (meta.length > 0) {
    parts.push("", ...meta);
  }

  const nutrition: string[] = [];
  if (r.calories != null) nutrition.push(`• Калории: ${r.calories} ккал`);
  if (r.protein != null) nutrition.push(`• Белки: ${r.protein} г`);
  if (r.fat != null) nutrition.push(`• Жиры: ${r.fat} г`);
  if (r.carbs != null) nutrition.push(`• Углеводы: ${r.carbs} г`);
  if (nutrition.length > 0) {
    parts.push("", "📊 Пищевая ценность (на 1 порцию):", ...nutrition);
  }

  return parts.join("\n");
}
