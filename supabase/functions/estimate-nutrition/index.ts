import { corsHeaders, jsonResponse } from "../_shared/lib/http.ts";
import { estimateNutritionWithDeepseek } from "../_shared/lib/nutrition.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const ingredients = typeof body?.ingredients === "string" ? body.ingredients.trim() : "";
  const instructions = typeof body?.instructions === "string" ? body.instructions.trim() : "";

  if (!title || !ingredients || !instructions) {
    return jsonResponse({ error: "title, ingredients and instructions are required" }, 400);
  }

  const { nutrition, error } = await estimateNutritionWithDeepseek(DEEPSEEK_API_KEY, {
    title,
    ingredients,
    instructions,
  });

  if (!nutrition) {
    return jsonResponse({ error: error ?? "Failed to estimate nutrition" }, 502);
  }

  return jsonResponse({ nutrition });
});
