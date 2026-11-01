// deno-lint-ignore-file no-explicit-any
//
// Scheduled "recipe of the day" job. Called by an external scheduler
// (GitHub Actions) every ~3 days. It:
//   1. touches the DB (keep-alive heartbeat so the free-tier project never pauses),
//   2. generates a fresh recipe via DeepSeek and stores it in `recipes`,
//   3. broadcasts the recipe to every active bot client.
//
// Auth: verify_jwt is disabled for this function; instead it checks the
// x-cron-secret header against the CRON_SECRET env var.

import { createAdminClient } from "../_shared/api/supabase.ts";
import { createEmbedding } from "../_shared/embeddings.ts";
import { corsHeaders, jsonResponse } from "../_shared/lib/http.ts";
import { stripMarkdown } from "../_shared/lib/text.ts";
import { recipeKeyboard, sendMessage } from "../_shared/api/telegram.ts";
import { generateRecipe, RECIPE_CATEGORIES } from "../telegram-webhook/api/deepseek.ts";
import {
  getRecipeContent,
  insertRecipeWithDedup,
} from "../telegram-webhook/api/recipes.repo.ts";
import { formatRecipe } from "../telegram-webhook/lib/prompt.ts";
import { DEFAULT_CHAT_SETTINGS } from "../telegram-webhook/_config.ts";
import type { GeneratedRecipe } from "../_shared/types/index.ts";

const admin = createAdminClient();

// Themes keep the generated recipes varied from run to run.
const THEMES = [
  "быстрое блюдо на будний вечер",
  "праздничное блюдо для гостей",
  "бюджетный вариант из простых продуктов",
  "полезное низкокалорийное блюдо",
  "сытное блюдо для всей семьи",
  "необычное сочетание вкусов",
  "сезонное блюдо из осенних продуктов",
  "вегетарианский вариант",
  "блюдо кухни народов мира",
  "комфорт-фуд на выходные",
];

const BROADCAST_DELAY_MS = 50; // ~20 msg/sec, safely under Telegram limits

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Ask DeepSeek for a complete, ready-to-use recipe (no clarifying questions).
async function generateFreshRecipe(): Promise<GeneratedRecipe> {
  const category = pick(RECIPE_CATEGORIES.filter((c) => c !== "Другое"));
  const theme = pick(THEMES);
  const userMessage =
    `Придумай один новый оригинальный рецепт. Категория: "${category}". ` +
    `Тема: ${theme}. Дай полностью готовый рецепт с ингредиентами, ` +
    `пошаговыми инструкциями, КБЖУ и количеством порций. ` +
    `Не задавай уточняющих вопросов — сразу верни рецепт.`;

  // Slightly higher temperature than the chat default for more variety.
  return await generateRecipe(
    DEFAULT_CHAT_SETTINGS.model,
    DEFAULT_CHAT_SETTINGS.system_prompt,
    [],
    userMessage,
    1.0,
    DEFAULT_CHAT_SETTINGS.max_tokens,
  );
}

async function storeRecipe(
  generated: GeneratedRecipe,
  generatedText: string,
): Promise<{ text: string; recipeId: number | null }> {
  const passageInput = [generated.title, generated.ingredients, generated.instructions]
    .filter(Boolean)
    .join("\n\n");
  const embedding = await createEmbedding(passageInput, "passage");

  const dedup = await insertRecipeWithDedup(admin, {
    title: generated.title,
    description: generatedText,
    ingredients: generated.ingredients,
    instructions: generated.instructions,
    category: generated.category || null,
    embedding,
    nutrition: generated.nutrition,
  });

  if (dedup?.reused && dedup.recipe_id !== null) {
    const existing = await getRecipeContent(admin, dedup.recipe_id);
    if (existing) return { text: formatRecipe(existing), recipeId: dedup.recipe_id };
  }

  return { text: generatedText, recipeId: dedup?.recipe_id ?? null };
}

async function broadcast(text: string, recipeId: number | null): Promise<number> {
  const { data, error } = await admin
    .from("clients")
    .select("chat_id")
    .eq("subscribed", true);
  if (error) {
    console.error("Failed to load clients for broadcast:", error);
    return 0;
  }

  const chatIds = (data ?? []).map((r: { chat_id: number }) => r.chat_id);
  const markup = recipeId !== null ? recipeKeyboard(recipeId) : undefined;
  let sent = 0;

  for (const chatId of chatIds) {
    // sendMessage never throws; it logs Telegram errors (e.g. user blocked bot)
    // and returns, so one bad chat can't abort the whole broadcast.
    const res = markup
      ? await sendMessage(chatId, text, markup)
      : await sendMessage(chatId, text);
    if (res.ok) sent++;
    await sleep(BROADCAST_DELAY_MS);
  }

  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // Keep-alive heartbeat: a guaranteed DB round-trip so the free-tier project
  // stays active even if recipe generation later fails (DeepSeek/Gemini down).
  const { error: pingError } = await admin
    .from("recipes")
    .select("id", { head: true, count: "exact" });
  if (pingError) {
    console.error("Keep-alive DB ping failed:", pingError);
  }

  try {
    const generated = await generateFreshRecipe();

    if (generated.need_clarification || !generated.can_help || !generated.ingredients) {
      console.error("Generation did not return a usable recipe:", generated);
      return jsonResponse({ ok: true, kept_alive: true, recipe_saved: false });
    }

    const generatedText = stripMarkdown(formatRecipe({
      title: generated.title,
      ingredients: generated.ingredients,
      instructions: generated.instructions,
      ...generated.nutrition,
    }));

    const stored = await storeRecipe(generated, generatedText);
    const text = stripMarkdown(stored.text);
    const sent = await broadcast(text, stored.recipeId);

    return jsonResponse({
      ok: true,
      kept_alive: true,
      recipe_saved: stored.recipeId !== null,
      recipe_id: stored.recipeId,
      broadcast_sent: sent,
    });
  } catch (err) {
    console.error("cron-recipe error:", err);
    // The DB ping above already ran, so the project was kept alive regardless.
    return jsonResponse({ ok: false, kept_alive: true, error: "Generation failed" }, 500);
  }
});
