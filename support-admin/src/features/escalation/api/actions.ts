"use server";

import { createSupabaseServer } from "@/shared/api/supabase-server";
import { revalidatePath } from "next/cache";

export async function returnToBot(clientId: number) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { error } = await supabase
    .from("clients").update({ escalation_status: "normal" }).eq("id", clientId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath(`/chat/${clientId}`);
}
