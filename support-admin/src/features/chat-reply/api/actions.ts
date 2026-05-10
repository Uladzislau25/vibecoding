"use server";

import { createSupabaseServer } from "@/shared/api/supabase-server";
import { revalidatePath } from "next/cache";

export async function addNote(clientId: number, managerId: number, text: string) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { error } = await supabase.from("messages").insert({
    client_id: clientId, manager_id: managerId, text, sender_type: "note",
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/chat/${clientId}`);
}
