"use server";

import { createSupabaseServer } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export type ChatSettingsInput = {
  model: "deepseek-chat" | "deepseek-reasoner" | "deepseek-v3-0324" | "deepseek-r1-0528";
  max_tokens: number;
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

  const updateData: Record<string, string> = { status };
  if (status === "closed") {
    updateData.escalation_status = "normal";
  }

  const { error } = await supabase
    .from("clients")
    .update(updateData)
    .eq("id", clientId);
  if (error) throw new Error(error.message);

  revalidatePath(`/chat/${clientId}`);
  revalidatePath("/");
}

export async function getRecipesForPicker(search: string = "") {
  const supabase = await createSupabaseServer();
  let q = supabase
    .from("recipes")
    .select("id, title, category")
    .order("created_at", { ascending: false })
    .limit(60);
  if (search.trim()) q = q.ilike("title", `%${search.trim()}%`);
  const { data } = await q;
  return (data ?? []) as { id: number; title: string; category: string | null }[];
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

    const { data: clientRow } = await supabase
      .from("clients")
      .select("escalation_status")
      .eq("id", clientId)
      .single();
    if (clientRow && clientRow.escalation_status !== "normal") {
      await supabase
        .from("clients")
        .update({ escalation_status: "normal" })
        .eq("id", clientId);
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
  revalidatePath(`/chat/${clientId}`);
}

export async function addNote(
  clientId: number,
  managerId: number,
  text: string,
) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { error } = await supabase.from("messages").insert({
    client_id: clientId,
    manager_id: managerId,
    text,
    sender_type: "note",
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/chat/${clientId}`);
}

export async function updateClientTags(clientId: number, tags: string[]) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { error } = await supabase
    .from("clients")
    .update({ tags } as Record<string, unknown>)
    .eq("id", clientId);
  if (error) throw new Error(error.message);

  revalidatePath(`/chat/${clientId}`);
}

export async function returnToBot(clientId: number) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { error } = await supabase
    .from("clients")
    .update({ escalation_status: "normal" })
    .eq("id", clientId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath(`/chat/${clientId}`);
}
