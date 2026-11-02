// Deno tests for the pure recipe helpers. Kept out of the Next build via the
// tsconfig "tests" exclude. Run with: deno test web-app/tests/
import { assertEquals } from "jsr:@std/assert@1";
import {
  extractIngredients,
  parseRecipe,
  scaleRecipeText,
} from "../src/features/chat/lib/recipe.ts";

const SAMPLE = [
  "🍽️ Омлет с сыром",
  "",
  "🛒 Ингредиенты:",
  "• Яйца — 2 шт",
  "• Сыр — 50 г",
  "• Молоко — 100 мл",
  "",
  "👨‍🍳 Приготовление:",
  "1. Взбить яйца с молоком.",
  "2. Вылить на сковороду, посыпать сыром.",
  "",
  "⏱️ Время приготовления: 10 минут",
  "🍽️ Порций: 2",
  "",
  "📊 Пищевая ценность (на 1 порцию):",
  "• Калории: 300 ккал",
  "• Белки: 20 г",
].join("\n");

Deno.test("parseRecipe splits sections", () => {
  const p = parseRecipe(SAMPLE)!;
  assertEquals(p.title, "Омлет с сыром");
  assertEquals(p.ingredients, ["Яйца — 2 шт", "Сыр — 50 г", "Молоко — 100 мл"]);
  assertEquals(p.steps.length, 2);
  assertEquals(p.steps[0], "Взбить яйца с молоком.");
  assertEquals(p.nutrition, ["Калории: 300 ккал", "Белки: 20 г"]);
});

Deno.test("parseRecipe returns null for plain chat text", () => {
  assertEquals(parseRecipe("Привет! Что приготовить?"), null);
});

Deno.test("scaleRecipeText scales ingredients and nutrition but not steps/time", () => {
  const scaled = scaleRecipeText(SAMPLE, 2);
  const p = parseRecipe(scaled)!;
  assertEquals(p.ingredients, ["Яйца — 4 шт", "Сыр — 100 г", "Молоко — 200 мл"]);
  assertEquals(p.nutrition, ["Калории: 600 ккал", "Белки: 40 г"]);
  // Step text (which happens to contain no numbers here) and cook time untouched.
  assertEquals(scaled.includes("⏱️ Время приготовления: 10 минут"), true);
  assertEquals(scaled.includes("🍽️ Порций: 4"), true);
});

Deno.test("scaleRecipeText by half handles decimals with comma", () => {
  const scaled = scaleRecipeText("🛒 Ингредиенты:\n• Яйца — 3 шт\n👨‍🍳 Приготовление:\n1. Смешать.", 0.5);
  assertEquals(scaled.includes("Яйца — 1,5 шт"), true);
});

Deno.test("extractIngredients returns ingredient lines", () => {
  assertEquals(extractIngredients(SAMPLE), ["Яйца — 2 шт", "Сыр — 50 г", "Молоко — 100 мл"]);
});
