"use server";

import { createSupabaseServer } from "@/shared/api/supabase-server";
import { revalidatePath } from "next/cache";

export type ChatSettingsInput = {
  model: "deepseek-chat" | "deepseek-reasoner" | "deepseek-v3-0324" | "deepseek-r1-0528";
  max_tokens: number;
};

export async function updateChatSettings(clientId: number, settings: ChatSettingsInput) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { error } = await supabase
    .from("chat_settings")
    .upsert({ client_id: clientId, ...settings }, { onConflict: "client_id" });
  if (error) throw new Error(error.message);

  revalidatePath(`/chat/${clientId}`);
}

export async function updateChatStatus(clientId: number, status: "open" | "closed") {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const updateData: Record<string, string> = { status };
  if (status === "closed") updateData.escalation_status = "normal";

  const { error } = await supabase.from("clients").update(updateData).eq("id", clientId);
  if (error) throw new Error(error.message);

  revalidatePath(`/chat/${clientId}`);
  revalidatePath("/");
}
