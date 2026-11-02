import type { GeneratedRecipe, ConversationMessage, TokenUsage } from "../../_shared/types/index.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;

export const RECIPE_CATEGORIES = [
  "Супы", "Салаты", "Основные блюда", "Десерты",
  "Завтраки", "Закуски", "Выпечка", "Напитки", "Другое",
];

const CATEGORY_LIST = RECIPE_CATEGORIES.join(", ");

const JSON_SCHEMA_INSTRUCTION = `
Верни ответ строго в формате JSON. Возможны три варианта:

1. Если пользователь назвал блюдо без деталей (например просто "борщ", "паста", "пирог", "салат", "суп") — ОБЯЗАТЕЛЬНО уточни какой именно вариант он хочет. Предложи 3-4 конкретных варианта. Не более 3 уточнений подряд без рецепта:
{"need_clarification": true, "question": "твой вопрос", "options": ["Вариант 1", "Вариант 2", "Вариант 3"], "can_help": true, "title": "", "category": "", "ingredients": "", "instructions": "", "calories": null, "protein": null, "fat": null, "carbs": null, "cook_time": "", "servings": null}

2. Если деталей достаточно — дай рецепт:
{
  "need_clarification": false,
  "can_help": true,
  "title": "краткое название рецепта (до 256 символов)",
  "category": "одна из: ${CATEGORY_LIST}",
  "ingredients": "список ингредиентов с количествами, каждый с новой строки через • (например: • Свёкла — 300 г)",
  "instructions": "пошаговые инструкции, каждый шаг с новой строки пронумерован (например: 1. Нарезать...)",
  "calories": <число ккал на 1 порцию>,
  "protein": <число г белков на 1 порцию>,
  "fat": <число г жиров на 1 порцию>,
  "carbs": <число г углеводов на 1 порцию>,
  "cook_time": "<строка времени, например '30 минут' или '1 час 15 минут'>",
  "servings": <число порций>
}

3. Если запрос не кулинарный:
{"need_clarification": false, "can_help": false, "title": "", "category": "", "ingredients": "", "instructions": "", "calories": null, "protein": null, "fat": null, "carbs": null, "cook_time": "", "servings": null}

Никакого текста вне JSON. Только валидный JSON. Никаких символов *** или ## в тексте. КБЖУ и порции — обязательные числа для варианта 2.`;

export async function generateRecipe(
  model: string,
  systemPrompt: string,
  history: ConversationMessage[],
  userMessage: string,
  temperature: number,
  maxTokens: number,
): Promise<GeneratedRecipe> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt + "\n\n" + JSON_SCHEMA_INSTRUCTION },
        ...history,
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek error: ${res.status} ${await res.text()}`);

  const body = await res.json();
  const content = body.choices[0].message.content;
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const u = body.usage ?? {};

  const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

  return {
    need_clarification: parsed.need_clarification === true,
    question: typeof parsed.question === "string" ? parsed.question : "",
    options: Array.isArray(parsed.options) ? (parsed.options as string[]).slice(0, 6) : [],
    can_help: parsed.can_help !== false,
    title: (typeof parsed.title === "string" ? parsed.title : "Рецепт").slice(0, 256),
    category: RECIPE_CATEGORIES.includes(typeof parsed.category === "string" ? parsed.category : "")
      ? (parsed.category as string)
      : "Другое",
    ingredients: typeof parsed.ingredients === "string" ? parsed.ingredients : "",
    instructions: typeof parsed.instructions === "string" ? parsed.instructions : "",
    nutrition: {
      calories: numOrNull(parsed.calories),
      protein: numOrNull(parsed.protein),
      fat: numOrNull(parsed.fat),
      carbs: numOrNull(parsed.carbs),
      cook_time: strOrNull(parsed.cook_time),
      servings: numOrNull(parsed.servings),
    },
    usage: {
      prompt_tokens: typeof u.prompt_tokens === "number" ? u.prompt_tokens : null,
      completion_tokens: typeof u.completion_tokens === "number" ? u.completion_tokens : null,
      total_tokens: typeof u.total_tokens === "number" ? u.total_tokens : null,
    },
  };
}

export type DishSuggestion = { title: string; description: string };

export type DishSuggestions = {
  can_help: boolean;
  suggestions: DishSuggestion[];
  usage: TokenUsage;
};

const SUGGEST_SCHEMA_INSTRUCTION = `
Пользователь перечислил продукты, которые у него есть. Предложи 3-5 блюд, которые можно
приготовить ПРЕИМУЩЕСТВЕННО из этих продуктов. Можно считать, что есть соль, перец, масло,
вода и базовые специи — их перечислять не нужно. Не добавляй других ингредиентов, которых
нет в списке. Варианты должны быть разными по типу (например, суп / второе / салат / запеканка).

Верни ответ строго в формате JSON:

Если в сообщении действительно перечислены съедобные продукты:
{"can_help": true, "suggestions": [{"title": "Название блюда", "description": "короткое описание в одну строку: что это и чем хорошо, можно указать примерное время"}, ...]}

Если это не список продуктов или не про еду:
{"can_help": false, "suggestions": []}

Никакого текста вне JSON. Только валидный JSON. Никаких символов *** или ## в тексте.
3-5 вариантов. Описание — одна короткая строка без переносов.`;

export async function suggestDishes(
  model: string,
  systemPrompt: string,
  products: string,
  temperature: number,
  maxTokens: number,
): Promise<DishSuggestions> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt + "\n\n" + SUGGEST_SCHEMA_INSTRUCTION },
        { role: "user", content: `Продукты: ${products}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek suggest error: ${res.status} ${await res.text()}`);

  const body = await res.json();
  const parsed = JSON.parse(body.choices[0].message.content) as Record<string, unknown>;
  const u = body.usage ?? {};

  const rawList = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  const suggestions: DishSuggestion[] = rawList
    .map((item): DishSuggestion | null => {
      const rec = item as Record<string, unknown>;
      const title = typeof rec.title === "string" ? rec.title.trim() : "";
      if (!title) return null;
      const description = typeof rec.description === "string" ? rec.description.trim() : "";
      return { title: title.slice(0, 120), description: description.slice(0, 200) };
    })
    .filter((s): s is DishSuggestion => s !== null)
    .slice(0, 5);

  return {
    can_help: parsed.can_help !== false && suggestions.length > 0,
    suggestions,
    usage: {
      prompt_tokens: typeof u.prompt_tokens === "number" ? u.prompt_tokens : null,
      completion_tokens: typeof u.completion_tokens === "number" ? u.completion_tokens : null,
      total_tokens: typeof u.total_tokens === "number" ? u.total_tokens : null,
    },
  };
}

export async function generateWeekPlan(dietaryNotes: string | null | undefined): Promise<string> {
  const dietLine = dietaryNotes ? `Учитывай предпочтения пользователя: ${dietaryNotes}.` : "";
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: "deepseek-flash",
      temperature: 0.9,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content:
            "Ты Шеф — кулинарный помощник. Составь план питания на 7 дней (завтрак, обед, ужин). " +
            "Используй только эмодзи и обычный текст. Никаких *** или ## markdown. " +
            dietLine,
        },
        { role: "user", content: "Составь план питания на 7 дней с завтраком, обедом и ужином." },
      ],
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek week plan error: ${res.status}`);
  const body = await res.json();
  return body.choices[0].message.content as string;
}
