"use server";

import { createSupabaseServer } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export type RecipeInput = {
  title: string;
  description: string;
  ingredients: string;
  instructions: string;
};

async function requireUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");
  return supabase;
}

export async function createRecipe(input: RecipeInput) {
  const supabase = await requireUser();

  const { data, error } = await supabase.functions.invoke("add-recipe", {
    body: input,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  revalidatePath("/recipes");
}

export async function updateRecipe(id: number, input: RecipeInput) {
  const supabase = await requireUser();

  const { data, error } = await supabase.functions.invoke("add-recipe", {
    body: { id, ...input },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  revalidatePath("/recipes");
}

export async function deleteRecipe(id: number) {
  const supabase = await requireUser();

  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/recipes");
}
