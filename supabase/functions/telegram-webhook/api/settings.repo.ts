// deno-lint-ignore-file no-explicit-any
import type { ClientSettings } from "../../_shared/types/index.ts";
import { DEFAULT_CHAT_SETTINGS } from "../_config.ts";

export async function getChatSettings(db: any, clientId: number): Promise<ClientSettings> {
  const { data } = await db
    .from("chat_settings")
    .select("model, temperature, max_tokens, system_prompt")
    .eq("client_id", clientId)
    .maybeSingle();

  return {
    model: data?.model ?? DEFAULT_CHAT_SETTINGS.model,
    temperature: data?.temperature ?? DEFAULT_CHAT_SETTINGS.temperature,
    max_tokens: data?.max_tokens ?? DEFAULT_CHAT_SETTINGS.max_tokens,
    system_prompt: data?.system_prompt ?? DEFAULT_CHAT_SETTINGS.system_prompt,
  };
}
