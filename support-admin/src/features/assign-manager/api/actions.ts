"use server";

import { createSupabaseServer } from "@/shared/api/supabase-server";
import { revalidatePath } from "next/cache";

export async function assignManager(clientId: number, managerId: number | null) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { data: currentManager } = await supabase
    .from("managers").select("id").eq("user_id", user.id).single();

  if (managerId === null) {
    const { data: existing } = await supabase
      .from("client_assignments").select("assigned_manager_id").eq("client_id", clientId).maybeSingle();

    await supabase.from("client_assignments").delete().eq("client_id", clientId);

    if (existing?.assigned_manager_id) {
      await supabase.from("messages_managers").insert({
        client_id: clientId, manager_id: existing.assigned_manager_id, action: "unassigned",
      });
    }

    const { data: clientRow } = await supabase
      .from("clients").select("escalation_status").eq("id", clientId).single();
    if (clientRow && clientRow.escalation_status !== "normal") {
      await supabase.from("clients").update({ escalation_status: "normal" }).eq("id", clientId);
    }
  } else {
    const { error } = await supabase.from("client_assignments").upsert(
      {
        client_id: clientId,
        assigned_manager_id: managerId,
        assigned_by_manager_id: currentManager?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" },
    );
    if (error) throw new Error(error.message);

    await supabase.from("messages_managers").insert({
      client_id: clientId, manager_id: managerId, action: "assigned",
    });
  }

  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath(`/chat/${clientId}`);
}
