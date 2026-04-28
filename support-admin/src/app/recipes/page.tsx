import { supabase } from "@/lib/supabase";
import RecipesList from "./recipes-list";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, description, ingredients, instructions, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <p className="text-red-500 text-lg">
          Ошибка загрузки: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <main className="max-w-4xl mx-auto px-6 py-6">
        <RecipesList recipes={data ?? []} />
      </main>
    </div>
  );
}
