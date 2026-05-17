// deno-lint-ignore-file no-explicit-any
import type { ClientSettings, ConversationMessage } from "../../_shared/types/index.ts";
import { getChatSettings } from "../api/settings.repo.ts";
import { getDietaryNotes } from "../api/preferences.repo.ts";
import { getRecentHistory, type MessageRow } from "../api/messages.repo.ts";
import { buildSystemPrompt } from "./prompt.ts";

export type ChatContext = {
  settings: ClientSettings;
  systemPrompt: string;
  conversationHistory: ConversationMessage[];
  chronologicalHistory: MessageRow[];
};

export async function gatherChatContext(db: any, clientId: number): Promise<ChatContext> {
  const [settings, dietaryNotes, history] = await Promise.all([
    getChatSettings(db, clientId),
    getDietaryNotes(db, clientId),
    getRecentHistory(db, clientId, 10),
  ]);

  const systemPrompt = buildSystemPrompt(settings.system_prompt, dietaryNotes);
  const chronologicalHistory = history.slice().reverse();
  const conversationHistory: ConversationMessage[] = chronologicalHistory
    .slice(0, -1)
    .map((m) => ({
      role: m.sender_type === "bot" ? "assistant" : "user",
      content: m.text,
    }));

  return { settings, systemPrompt, conversationHistory, chronologicalHistory };
}

export function deriveContextQuery(history: MessageRow[], fallback: string): string {
  return (
    history
      .filter((m) => m.sender_type === "client")
      .slice(-2)
      .map((m) => m.text)
      .join(" ") || fallback
  );
}
