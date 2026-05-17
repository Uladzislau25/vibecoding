// deno-lint-ignore-file no-explicit-any

export type RecipeSearchMatch = {
  id: number;
  title: string;
  description: string | null;
  similarity: number;
};

export type RecipeSummary = {
  id: number;
  title: string;
  description: string | null;
};

export type RecipeDedupResult = {
  recipe_id: number | null;
  description: string | null;
};

export type RecipeInsertInput = {
  title: string;
  description: string;
  ingredients: string;
  instructions: string;
  category: string | null;
  embedding: number[];
};

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
    .select("id, title, description")
    .order("id", { ascending: false })
    .limit(pool);
  const rows = (data ?? []) as RecipeSummary[];
  if (rows.length === 0) return null;
  return rows[Math.floor(Math.random() * rows.length)];
}
