"use server";

import { createSupabaseServer } from "@/lib/supabase-server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type RecipeInput = {
  title: string;
  description: string;
  ingredients: string;
  instructions: string;
};

export async function createRecipe(input: RecipeInput) {
  await requireRole("admin", "manager");
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase.functions.invoke("add-recipe", {
    body: input,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  revalidatePath("/recipes");
}

export async function updateRecipe(id: number, input: RecipeInput) {
  await requireRole("admin", "manager");
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase.functions.invoke("add-recipe", {
    body: { id, ...input },
  });
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
