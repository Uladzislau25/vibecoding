export type EstimatedNutrition = {
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  cook_time: string | null;
  servings: number | null;
};

export type EstimateNutritionInput = {
  title: string;
  ingredients: string;
  instructions: string;
};

const PROMPT = `You are a nutritionist. You will receive a dish name, ingredients and instructions. Estimate calories/protein/fat/carbs per single serving, total cooking time and number of servings.

Reply with a valid JSON object only. Schema:
{"calories": <number, kcal per serving>, "protein": <number, grams per serving>, "fat": <number, grams per serving>, "carbs": <number, grams per serving>, "cook_time": <string, Russian, e.g. "30 минут">, "servings": <integer>}

No text outside the JSON. JSON only.`;

export async function estimateNutritionWithDeepseek(
  apiKey: string,
  input: EstimateNutritionInput,
): Promise<{ nutrition: EstimatedNutrition | null; error: string | null }> {
  const userText = `Название: ${input.title}\n\nИнгредиенты:\n${input.ingredients}\n\nИнструкции:\n${input.instructions}`;

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: userText },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { nutrition: null, error: `deepseek_${res.status}: ${text.slice(0, 200)}` };
  }

  const body = await res.json();
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string") return { nutrition: null, error: "deepseek_empty_content" };

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
    return {
      nutrition: {
        calories: num(parsed.calories),
        protein: num(parsed.protein),
        fat: num(parsed.fat),
        carbs: num(parsed.carbs),
        cook_time: str(parsed.cook_time),
        servings: num(parsed.servings),
      },
      error: null,
    };
  } catch (err) {
    return { nutrition: null, error: `parse_failed: ${(err as Error).message}; content: ${content.slice(0, 200)}` };
  }
}

export function buildRecipeDescription(input: {
  title: string;
  ingredients: string;
  instructions: string;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  cook_time: string | null;
  servings: number | null;
}): string {
  const parts: string[] = [
    `🍽️ ${input.title}`,
    "",
    "🛒 Ингредиенты:",
    input.ingredients,
    "",
    "👨‍🍳 Приготовление:",
    input.instructions,
  ];

  const meta: string[] = [];
  if (input.cook_time) meta.push(`⏱️ Время приготовления: ${input.cook_time}`);
  if (input.servings) meta.push(`🍽️ Порций: ${input.servings}`);
  if (meta.length > 0) parts.push("", ...meta);

  const nutrition: string[] = [];
  if (input.calories != null) nutrition.push(`• Калории: ${input.calories} ккал`);
  if (input.protein != null) nutrition.push(`• Белки: ${input.protein} г`);
  if (input.fat != null) nutrition.push(`• Жиры: ${input.fat} г`);
  if (input.carbs != null) nutrition.push(`• Углеводы: ${input.carbs} г`);
  if (nutrition.length > 0) {
    parts.push("", "📊 Пищевая ценность (на 1 порцию):", ...nutrition);
  }

  return parts.join("\n");
}
