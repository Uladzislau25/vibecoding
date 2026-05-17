// deno-lint-ignore-file no-explicit-any

import type { RecipeNutrition } from "../../_shared/types/index.ts";

export type RecipeSearchMatch = RecipeNutrition & {
  id: number;
  title: string;
  description: string | null;
  ingredients: string;
  instructions: string;
  similarity: number;
};

export type RecipeSummary = RecipeNutrition & {
  id: number;
  title: string;
  ingredients: string;
  instructions: string;
};

export type RecipeDedupResult = {
  recipe_id: number | null;
  reused: boolean;
  description: string | null;
};

export type RecipeContent = RecipeNutrition & {
  title: string;
  ingredients: string;
  instructions: string;
};

export type RecipeInsertInput = {
  title: string;
  description: string;
  ingredients: string;
  instructions: string;
  category: string | null;
  embedding: number[];
  nutrition: RecipeNutrition;
};

const RECIPE_FIELDS_SQL =
  "id, title, ingredients, instructions, calories, protein, fat, carbs, cook_time, servings";

export async function searchSimilarRecipes(
  db: any,
  queryEmbedding: number[],
  queryText: string,
  matchCount = 1,
): Promise<RecipeSearchMatch[]> {
  const { data, error } = await db.rpc("search_recipes", {
    query_embedding: JSON.stringify(queryEmbedding),
    query_text: queryText,
    match_count: matchCount,
  });
  if (error) {
    console.error("search_recipes error:", error);
    return [];
  }
  return (data ?? []) as RecipeSearchMatch[];
}

export async function insertRecipeWithDedup(
  db: any,
  input: RecipeInsertInput,
): Promise<RecipeDedupResult | null> {
  const { data, error } = await db
    .rpc("insert_recipe_dedup", {
      p_title: input.title,
      p_description: input.description,
      p_ingredients: input.ingredients,
      p_instructions: input.instructions,
      p_category: input.category,
      p_embedding: JSON.stringify(input.embedding),
      p_calories: input.nutrition.calories,
      p_protein: input.nutrition.protein,
      p_fat: input.nutrition.fat,
      p_carbs: input.nutrition.carbs,
      p_cook_time: input.nutrition.cook_time,
      p_servings: input.nutrition.servings,
    })
    .single();

  if (error || !data) {
    console.error("Failed to save recipe:", error);
    return null;
  }
  return data as RecipeDedupResult;
}

export async function getRecipeTitle(db: any, recipeId: number): Promise<string | null> {
  const { data } = await db.from("recipes").select("title").eq("id", recipeId).maybeSingle();
  return data?.title ?? null;
}

export async function getRecipeForShopping(
  db: any,
  recipeId: number,
): Promise<{ title: string; ingredients: string } | null> {
  const { data } = await db
    .from("recipes")
    .select("title, ingredients")
    .eq("id", recipeId)
    .maybeSingle();
  return (data as { title: string; ingredients: string } | null) ?? null;
}

export async function pickRandomRecipe(db: any, pool = 100): Promise<RecipeSummary | null> {
  const { data } = await db
    .from("recipes")
    .select(RECIPE_FIELDS_SQL)
    .order("id", { ascending: false })
    .limit(pool);
  const rows = (data ?? []) as RecipeSummary[];
  if (rows.length === 0) return null;
  return rows[Math.floor(Math.random() * rows.length)];
}

export async function getRecipeContent(db: any, recipeId: number): Promise<RecipeContent | null> {
  const { data } = await db
    .from("recipes")
    .select("title, ingredients, instructions, calories, protein, fat, carbs, cook_time, servings")
    .eq("id", recipeId)
    .maybeSingle();
  return (data as RecipeContent | null) ?? null;
}
