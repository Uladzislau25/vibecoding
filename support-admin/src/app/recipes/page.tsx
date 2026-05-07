import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/auth";
import RecipesList from "./recipes-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Рецепты" };

export default async function RecipesPage() {
  const [recipesResult, role] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, title, description, ingredients, instructions, created_at")
      .order("created_at", { ascending: false }),
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

  const canEdit = role === "admin" || role === "manager";

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-950">
      <main className="max-w-4xl mx-auto px-6 py-6">
        <RecipesList recipes={recipesResult.data ?? []} canEdit={canEdit} />
      </main>
    </div>
  );
}
