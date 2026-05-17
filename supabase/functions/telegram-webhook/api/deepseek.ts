import type { GeneratedRecipe, ConversationMessage } from "../../_shared/types/index.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;

export const RECIPE_CATEGORIES = [
  "Супы", "Салаты", "Основные блюда", "Десерты",
  "Завтраки", "Закуски", "Выпечка", "Напитки", "Другое",
];

const CATEGORY_LIST = RECIPE_CATEGORIES.join(", ");

const JSON_SCHEMA_INSTRUCTION = `
Верни ответ строго в формате JSON. Возможны три варианта:

1. Если пользователь назвал блюдо без деталей (например просто "борщ", "паста", "пирог", "салат", "суп") — ОБЯЗАТЕЛЬНО уточни какой именно вариант он хочет. Предложи 3-4 конкретных варианта. Не более 3 уточнений подряд без рецепта:
{"need_clarification": true, "question": "твой вопрос", "options": ["Вариант 1", "Вариант 2", "Вариант 3"], "can_help": true, "title": "", "category": "", "ingredients": "", "instructions": "", "reply_text": ""}

2. Если деталей достаточно — дай рецепт:
{
  "need_clarification": false,
  "can_help": true,
  "title": "краткое название рецепта (до 256 символов)",
  "category": "одна из: ${CATEGORY_LIST}",
  "ingredients": "список ингредиентов с количествами, каждый с новой строки через • (например: • Свёкла — 300 г)",
  "instructions": "пошаговые инструкции, каждый шаг с новой строки пронумерован (например: 1. Нарезать...)",
  "reply_text": "полный ответ пользователю строго по шаблону:\\n🍽️ {название}\\n\\n🛒 Ингредиенты:\\n{ингредиенты через •}\\n\\n👨‍🍳 Приготовление:\\n{пронумерованные шаги}\\n\\n⏱️ Время приготовления: {время}\\n🍽️ Порций: {количество}\\n\\n📊 Пищевая ценность (на 1 порцию):\\n• Калории: {X} ккал\\n• Белки: {X} г\\n• Жиры: {X} г\\n• Углеводы: {X} г"
}

3. Если запрос не кулинарный:
{"need_clarification": false, "can_help": false, "title": "", "category": "", "ingredients": "", "instructions": "", "reply_text": ""}

Никакого текста вне JSON. Только валидный JSON. Никаких символов *** или ## в тексте.`;

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
  const parsed = JSON.parse(content) as Partial<GeneratedRecipe>;
  const u = body.usage ?? {};

  return {
    need_clarification: parsed.need_clarification === true,
    question: parsed.question ?? "",
    options: Array.isArray(parsed.options) ? parsed.options.slice(0, 6) : [],
    can_help: parsed.can_help !== false,
    title: (parsed.title ?? "Рецепт").slice(0, 256),
    category: RECIPE_CATEGORIES.includes(parsed.category ?? "") ? (parsed.category ?? "Другое") : "Другое",
    ingredients: parsed.ingredients ?? "",
    instructions: parsed.instructions ?? "",
    reply_text: parsed.reply_text ?? content,
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
      model: "deepseek-v4-flash",
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
