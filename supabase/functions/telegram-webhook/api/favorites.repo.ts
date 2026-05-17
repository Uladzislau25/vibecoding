// deno-lint-ignore-file no-explicit-any

const DUPLICATE_KEY = "23505";

export type FavoriteInsertResult = "ok" | "duplicate" | "error";

export async function addFavorite(
  db: any,
  clientId: number,
  recipeId: number,
  title: string,
): Promise<FavoriteInsertResult> {
  const { error } = await db.from("client_favorite_recipes").insert({
    client_id: clientId,
    recipe_id: recipeId,
    title,
  });
  if (!error) return "ok";
  if (error.code === DUPLICATE_KEY) return "duplicate";
  console.error("Failed to add favorite:", error);
  return "error";
}

export async function listFavoriteTitles(
  db: any,
  clientId: number,
  limit = 20,
): Promise<string[]> {
  const { data } = await db
    .from("client_favorite_recipes")
    .select("title")
    .eq("client_id", clientId)
    .order("saved_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as { title: string }[]).map((r) => r.title);
}
