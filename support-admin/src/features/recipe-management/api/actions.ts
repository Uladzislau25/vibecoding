"use server";

import { createSupabaseServer } from "@/shared/api/supabase-server";
import { requireRole } from "@/shared/lib/auth";
import { revalidatePath } from "next/cache";

export type RecipeInput = {
  title: string;
  ingredients: string;
  instructions: string;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  cook_time: string | null;
  servings: number | null;
};

export async function getRecipesForPicker(search: string = "") {
  const supabase = await createSupabaseServer();
  let q = supabase
    .from("recipes").select("id, title, category")
    .order("created_at", { ascending: false }).limit(60);
  if (search.trim()) q = q.ilike("title", `%${search.trim()}%`);
  const { data } = await q;
  return (data ?? []) as { id: number; title: string; category: string | null }[];
}

export async function createRecipe(input: RecipeInput) {
  await requireRole("admin", "manager");
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase.functions.invoke("add-recipe", { body: input });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  revalidatePath("/recipes");
}

export async function updateRecipe(id: number, input: RecipeInput) {
  await requireRole("admin", "manager");
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase.functions.invoke("add-recipe", { body: { id, ...input } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  revalidatePath("/recipes");
}

export async function deleteRecipe(id: number) {
  await requireRole("admin", "manager");
  const supabase = await createSupabaseServer();

  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/recipes");
}
