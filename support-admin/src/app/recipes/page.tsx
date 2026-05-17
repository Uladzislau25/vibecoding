import { supabase } from "@/shared/api/supabase-anon";
import { getUserRole } from "@/shared/lib/auth";
import RecipesList from "@/widgets/recipe-list/ui/RecipesList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Рецепты" };

export default async function RecipesPage() {
  const [recipesResult, ratingsResult, role] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, title, description, ingredients, instructions, category, calories, protein, fat, carbs, cook_time, servings, created_at")
      .order("created_at", { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("recipe_ratings").select("recipe_id, rating"),
    getUserRole(),
  ]);

  if (recipesResult.error) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-950 flex items-center justify-center">
        <p className="text-red-500 text-lg">
          Ошибка загрузки: {recipesResult.error.message}
        </p>
      </div>
    );
  }

  // Aggregate ratings per recipe
  const ratingsMap: Record<number, { up: number; down: number }> = {};
  for (const r of (ratingsResult.data ?? []) as { recipe_id: number; rating: number }[]) {
    if (!ratingsMap[r.recipe_id]) ratingsMap[r.recipe_id] = { up: 0, down: 0 };
    if (r.rating === 1) ratingsMap[r.recipe_id].up++;
    else ratingsMap[r.recipe_id].down++;
  }

  const canEdit = role === "admin" || role === "manager";

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-950">
      <main className="max-w-4xl mx-auto px-6 py-6">
        <RecipesList recipes={recipesResult.data ?? []} ratingsMap={ratingsMap} canEdit={canEdit} />
      </main>
    </div>
  );
}
