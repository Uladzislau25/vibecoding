export function buildSystemPrompt(basePrompt: string, dietaryNotes: string | null): string {
  if (!dietaryNotes) return basePrompt;
  return `${basePrompt}\n\nПользователь указал предпочтения: ${dietaryNotes}. Всегда учитывай это при составлении рецептов.`;
}

export function withServings(systemPrompt: string, servings: number | null): string {
  if (!servings) return systemPrompt;
  return `${systemPrompt}\n\nПользователь хочет рецепт на ${servings} порций.`;
}
