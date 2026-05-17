import { createAdminClient } from "../_shared/api/supabase.ts";
import { corsHeaders, jsonResponse } from "../_shared/lib/http.ts";
import { buildRecipeDescription, estimateNutritionWithDeepseek } from "../_shared/lib/nutrition.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const admin = createAdminClient();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body?.limit) || 5, 1), 20);

  const { data: pending, error: fetchError } = await admin
    .from("recipes")
    .select("id, title, ingredients, instructions")
    .is("calories", null)
    .order("id", { ascending: true })
    .limit(limit);

  if (fetchError) {
    console.error("Failed to fetch recipes:", fetchError);
    return jsonResponse({ error: "Failed to fetch recipes" }, 500);
  }

  const recipes = (pending ?? []) as { id: number; title: string; ingredients: string; instructions: string }[];

  const results: { id: number; ok: boolean; error?: string }[] = [];
  for (const r of recipes) {
    const { nutrition, error: aiError } = await estimateNutritionWithDeepseek(DEEPSEEK_API_KEY, {
      title: r.title,
      ingredients: r.ingredients,
      instructions: r.instructions,
    });
    if (!nutrition) {
      results.push({ id: r.id, ok: false, error: aiError ?? "no_nutrition" });
      continue;
    }

    const description = buildRecipeDescription({
      title: r.title,
      ingredients: r.ingredients,
      instructions: r.instructions,
      ...nutrition,
    });

    const { error: updateError } = await admin
      .from("recipes")
      .update({ ...nutrition, description })
      .eq("id", r.id);

    results.push({
      id: r.id,
      ok: !updateError,
      ...(updateError ? { error: `update_failed: ${updateError.message}` } : {}),
    });
  }

  const { count: remaining } = await admin
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .is("calories", null);

  return jsonResponse({
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    remaining: remaining ?? 0,
    results,
  });
});
