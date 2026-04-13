"use server";

import { createSupabaseServer } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function assignManager(clientId: number, managerId: number) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  // Get current manager's id
  const { data: currentManager } = await supabase
    .from("managers")
    .select("id")
    .eq("user_id", user.id)
    .single();

  // Upsert assignment (client_id is unique in client_assignments)
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

  revalidatePath(`/chat/${clientId}`);
  revalidatePath("/");
}
