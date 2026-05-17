// deno-lint-ignore-file no-explicit-any

export async function getDietaryNotes(db: any, clientId: number): Promise<string | null> {
  const { data } = await db
    .from("client_preferences")
    .select("dietary_notes")
    .eq("client_id", clientId)
    .maybeSingle();
  return data?.dietary_notes ?? null;
}

export async function savePreferences(db: any, clientId: number, notes: string): Promise<void> {
  await db.from("client_preferences").upsert(
    { client_id: clientId, dietary_notes: notes, updated_at: new Date().toISOString() },
    { onConflict: "client_id" },
  );
}

export async function clearPreferences(db: any, clientId: number): Promise<void> {
  await db.from("client_preferences").delete().eq("client_id", clientId);
}
