// deno-lint-ignore-file no-explicit-any

export type ClientRow = {
  id: number;
  escalation_status: string | null;
  setup_state: string | null;
};

export type ClientIdentity = {
  chatId: number;
  userId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};

export async function upsertClient(db: any, identity: ClientIdentity): Promise<ClientRow | null> {
  const { data, error } = await db
    .from("clients")
    .upsert(
      {
        chat_id: identity.chatId,
        user_id: identity.userId,
        username: identity.username,
        first_name: identity.firstName,
        last_name: identity.lastName,
      },
      { onConflict: "chat_id" },
    )
    .select("id, escalation_status, setup_state")
    .single();

  if (error) {
    console.error("Failed to upsert client:", error);
    return null;
  }
  return data as ClientRow;
}

export async function findClientByChat(db: any, chatId: number): Promise<{ id: number } | null> {
  const { data } = await db.from("clients").select("id").eq("chat_id", chatId).maybeSingle();
  return data ?? null;
}

export async function reopenIfClosed(db: any, clientId: number): Promise<void> {
  const { data } = await db.from("clients").select("status").eq("id", clientId).single();
  if (data?.status === "closed") {
    await db.from("clients").update({ status: "open" }).eq("id", clientId);
  }
}

export async function clearSetupState(db: any, clientId: number): Promise<void> {
  await db.from("clients").update({ setup_state: null }).eq("id", clientId);
}

export async function setSetupState(db: any, clientId: number, state: string): Promise<void> {
  await db.from("clients").update({ setup_state: state }).eq("id", clientId);
}

export async function markEscalated(db: any, clientId: number): Promise<void> {
  await db
    .from("clients")
    .update({ escalation_status: "escalated", escalated_at: new Date().toISOString() })
    .eq("id", clientId);
}

export function isHandledByHuman(status: string | null): boolean {
  return status === "escalated" || status === "manager_active";
}
