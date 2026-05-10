"use server";

import { createSupabaseServer } from "@/shared/api/supabase-server";
import { revalidatePath } from "next/cache";

export async function updateClientTags(clientId: number, tags: string[]) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { error } = await supabase
    .from("clients").update({ tags } as Record<string, unknown>).eq("id", clientId);
  if (error) throw new Error(error.message);

  revalidatePath(`/chat/${clientId}`);
}
