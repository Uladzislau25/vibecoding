export type RecipeRow = {
  id: number;
  title: string;
  ingredients: string;
  instructions: string;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  cook_time: string | null;
  servings: number | null;
};

// Mirror of the bot's formatRecipe so web and Telegram render recipes the same.
export function formatRecipe(r: RecipeRow): string {
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
  if (meta.length > 0) parts.push("", ...meta);

  const nutrition: string[] = [];
  if (r.calories != null) nutrition.push(`• Калории: ${r.calories} ккал`);
  if (r.protein != null) nutrition.push(`• Белки: ${r.protein} г`);
  if (r.fat != null) nutrition.push(`• Жиры: ${r.fat} г`);
  if (r.carbs != null) nutrition.push(`• Углеводы: ${r.carbs} г`);
  if (nutrition.length > 0) parts.push("", "📊 Пищевая ценность (на 1 порцию):", ...nutrition);

  return parts.join("\n");
}

// Recipe bot messages start with "🍽️ <title>" — recover the title for save/share.
export function titleFromText(text: string): string {
  const first = text.split("\n")[0] ?? "";
  return first.replace(/^🍽️\s*/, "").trim() || "Рецепт";
}

// ── Structured parsing & scaling ────────────────────────────────────────────
// These operate on the text produced by formatRecipe so both fresh and stored
// recipes (which only keep the rendered text in chat history) can be rendered
// as cards and rescaled without a DB round-trip.

const ING_HEADER = "🛒 Ингредиенты:";
const STEP_HEADER = "👨‍🍳 Приготовление:";
const NUTR_HEADER = "📊";
const COOK_PREFIX = "⏱️";
const SERVINGS_PREFIX = "🍽️ Порций";

export type ParsedRecipe = {
  title: string;
  ingredients: string[];
  steps: string[];
  meta: string[];
  nutrition: string[];
};

// Recognise the formatRecipe layout. Returns null if it doesn't look like one
// (e.g. a plain chat reply), so the caller can fall back to plain text.
export function parseRecipe(text: string): ParsedRecipe | null {
  if (!text.includes(ING_HEADER) || !text.includes(STEP_HEADER)) return null;

  const lines = text.split("\n");
  const title = titleFromText(text);
  const ingredients: string[] = [];
  const steps: string[] = [];
  const meta: string[] = [];
  const nutrition: string[] = [];
  let section: "ing" | "steps" | "nutr" | "other" = "other";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith(ING_HEADER)) { section = "ing"; continue; }
    if (line.startsWith(STEP_HEADER)) { section = "steps"; continue; }
    if (line.startsWith(NUTR_HEADER)) { section = "nutr"; continue; }
    if (line.startsWith(COOK_PREFIX) || line.startsWith(SERVINGS_PREFIX)) { meta.push(line); continue; }
    if (line.startsWith("🍽️")) continue; // title line
    if (section === "ing") ingredients.push(line.replace(/^•\s*/, ""));
    else if (section === "steps") steps.push(line.replace(/^\d+[.)]\s*/, ""));
    else if (section === "nutr") nutrition.push(line.replace(/^•\s*/, ""));
  }

  return { title, ingredients, steps, meta, nutrition };
}

function formatNum(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

function scaleNumbers(line: string, factor: number): string {
  return line.replace(/\d+(?:[.,]\d+)?/g, (m) => formatNum(parseFloat(m.replace(",", ".")) * factor));
}

// Rescale quantities: ingredient amounts, servings and nutrition get multiplied;
// cooking steps and cook time are left untouched (doubling a recipe doesn't
// double the oven time). Best-effort — it just scales every number it finds.
export function scaleRecipeText(text: string, factor: number): string {
  if (factor === 1) return text;
  let section: "ing" | "steps" | "nutr" | "other" = "other";
  return text
    .split("\n")
    .map((line) => {
      if (line.startsWith(ING_HEADER)) { section = "ing"; return line; }
      if (line.startsWith(STEP_HEADER)) { section = "steps"; return line; }
      if (line.startsWith(NUTR_HEADER)) { section = "nutr"; return line; }
      if (line.startsWith(COOK_PREFIX)) return line;
      if (line.startsWith(SERVINGS_PREFIX)) return scaleNumbers(line, factor);
      if (section === "ing" || section === "nutr") return scaleNumbers(line, factor);
      return line;
    })
    .join("\n");
}

// Ingredient lines for the shopping list: strip bullets and drop obvious
// non-items ("по вкусу", "соль/перец" lines are kept — they're harmless).
export function extractIngredients(text: string): string[] {
  const parsed = parseRecipe(text);
  if (parsed) return parsed.ingredients;
  // Fall back to raw "• " bullet lines (e.g. a shopping-list style message).
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("•"))
    .map((l) => l.replace(/^•\s*/, ""));
}
