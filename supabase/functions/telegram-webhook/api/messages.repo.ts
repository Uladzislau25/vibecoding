// deno-lint-ignore-file no-explicit-any
import type { TokenUsage } from "../../_shared/types/index.ts";

export type MessageRow = { text: string; sender_type: string };

export type InsertClientMessage = {
  clientId: number;
  text: string;
  telegramMessageId: number | null;
};

const DUPLICATE_KEY = "23505";

export async function insertClientMessage(
  db: any,
  msg: InsertClientMessage,
): Promise<"ok" | "duplicate" | "error"> {
  const { error } = await db.from("messages").insert({
    client_id: msg.clientId,
    text: msg.text,
    telegram_message_id: msg.telegramMessageId,
  });
  if (!error) return "ok";
  if (error.code === DUPLICATE_KEY) return "duplicate";
  console.error("Failed to save message:", error);
  return "error";
}

export async function insertBotMessage(
  db: any,
  clientId: number,
  text: string,
  recipeId: number | null = null,
  usage: TokenUsage = { prompt_tokens: null, completion_tokens: null, total_tokens: null },
): Promise<void> {
  const { error } = await db.from("messages").insert({
    client_id: clientId,
    text,
    sender_type: "bot",
    recipe_id: recipeId,
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
  });
  if (error) console.error("Failed to save bot reply:", error);
}

export async function countClientMessagesSince(
  db: any,
  clientId: number,
  sinceIso: string,
): Promise<number> {
  const { count } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("sender_type", "client")
    .gte("created_at", sinceIso);
  return count ?? 0;
}

export async function getRecentHistory(
  db: any,
  clientId: number,
  limit = 10,
): Promise<MessageRow[]> {
  const { data } = await db
    .from("messages")
    .select("text, sender_type")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as MessageRow[];
}

export async function getLastBotRecipeId(db: any, clientId: number): Promise<number | null> {
  const { data } = await db
    .from("messages")
    .select("recipe_id")
    .eq("client_id", clientId)
    .eq("sender_type", "bot")
    .not("recipe_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.recipe_id ?? null;
}
