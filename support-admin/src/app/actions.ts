"use server";

import { createSupabaseServer } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export type ChatSettingsInput = {
  model: "deepseek-chat" | "deepseek-reasoner";
  temperature: number;
  max_tokens: number;
  system_prompt: string;
};

export async function updateChatSettings(
  clientId: number,
  settings: ChatSettingsInput,
) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { error } = await supabase
    .from("chat_settings")
    .upsert(
      { client_id: clientId, ...settings },
      { onConflict: "client_id" },
    );
  if (error) throw new Error(error.message);

  revalidatePath(`/chat/${clientId}`);
}

export async function updateChatStatus(
  clientId: number,
  status: "open" | "closed",
) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { error } = await supabase
    .from("clients")
    .update({ status })
    .eq("id", clientId);
  if (error) throw new Error(error.message);

  revalidatePath(`/chat/${clientId}`);
  revalidatePath("/");
}

export async function assignManager(clientId: number, managerId: number | null) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { data: currentManager } = await supabase
    .from("managers")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (managerId === null) {
    const { data: existing } = await supabase
      .from("client_assignments")
      .select("assigned_manager_id")
      .eq("client_id", clientId)
      .maybeSingle();

    await supabase
      .from("client_assignments")
      .delete()
      .eq("client_id", clientId);

    if (existing?.assigned_manager_id) {
      await supabase.from("messages_managers").insert({
        client_id: clientId,
        manager_id: existing.assigned_manager_id,
        action: "unassigned",
      });
    }
  } else {
    const { error } = await supabase
      .from("client_assignments")
      .upsert(
        {
          client_id: clientId,
          assigned_manager_id: managerId,
          assigned_by_manager_id: currentManager?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" }
      );
    if (error) throw new Error(error.message);

    await supabase.from("messages_managers").insert({
      client_id: clientId,
      manager_id: managerId,
      action: "assigned",
    });
  }

  revalidatePath("/");
  revalidatePath("/history");
}
