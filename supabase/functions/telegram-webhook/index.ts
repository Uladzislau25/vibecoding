// deno-lint-ignore-file no-explicit-any
import { createAdminClient } from "../_shared/api/supabase.ts";
import { BUTTON_COMMAND_MAP } from "./_config.ts";
import {
  type ClientRow,
  isHandledByHuman,
  reopenIfClosed,
  upsertClient,
} from "./api/clients.repo.ts";
import { insertClientMessage } from "./api/messages.repo.ts";
import { deriveContextQuery, gatherChatContext } from "./lib/context.ts";
import {
  handleList,
  handlePreferences,
  handleRandom,
  handleSave,
  handleSaved,
  handleStart,
  handleWeek,
} from "./features/commands.ts";
import { handleCallbackQuery } from "./features/callback.ts";
import { tryHandleCasualReply } from "./features/casual-reply.ts";
import { completePreferencesSetup } from "./features/preferences-setup.ts";
import { isRateLimited } from "./features/rate-limit.ts";
import { processRecipeRequest } from "./features/recipe-reply.ts";

type TelegramMessage = {
  text?: string;
  message_id: number;
  chat: { id: number };
  from: { id: number; username?: string; first_name?: string; last_name?: string };
};

type TelegramUpdate = {
  message?: TelegramMessage;
  callback_query?: Parameters<typeof handleCallbackQuery>[1];
};

const OK = () => new Response("OK", { status: 200 });
const db = createAdminClient() as any;

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return OK();

    const update = (await req.json()) as TelegramUpdate;

    if (update.callback_query) {
      await handleCallbackQuery(db, update.callback_query);
      return OK();
    }

    const message = update.message;
    if (!message?.text) return OK();

    const chatId = message.chat.id;
    const rawText = message.text.trim();
    const text = BUTTON_COMMAND_MAP[rawText] ?? rawText;

    console.log(`Message from ${message.from?.first_name} (${message.from?.id}): ${text}`);

    if (text === "/start") {
      await handleStart(chatId);
      return OK();
    }

    const client = await ensureClient(message, chatId);
    if (!client) return OK();

    const saveResult = await insertClientMessage(db, {
      clientId: client.id,
      text,
      telegramMessageId: message.message_id,
    });
    if (saveResult !== "ok") return OK();

    if (isHandledByHuman(client.escalation_status)) return OK();

    if (await dispatchCommand(text, chatId, client.id)) return OK();

    if (await isRateLimited(db, chatId, client.id)) return OK();

    if (client.setup_state === "awaiting_preferences") {
      await completePreferencesSetup(db, chatId, client.id, text);
      return OK();
    }

    if (await tryHandleCasualReply(db, chatId, client.id, text, client.setup_state !== null)) {
      return OK();
    }

    const { settings, systemPrompt, conversationHistory, chronologicalHistory } =
      await gatherChatContext(db, client.id);

    await processRecipeRequest(db, {
      chatId,
      clientId: client.id,
      userText: text,
      settings,
      systemPrompt,
      history: conversationHistory,
      contextQuery: deriveContextQuery(chronologicalHistory, text),
    });

    return OK();
  } catch (err) {
    console.error("Error processing webhook:", err);
    return OK();
  }
});

async function ensureClient(message: TelegramMessage, chatId: number): Promise<ClientRow | null> {
  const client = await upsertClient(db, {
    chatId,
    userId: message.from.id,
    username: message.from.username ?? null,
    firstName: message.from.first_name ?? null,
    lastName: message.from.last_name ?? null,
  });
  if (!client) return null;
  await reopenIfClosed(db, client.id);
  return client;
}

async function dispatchCommand(text: string, chatId: number, clientId: number): Promise<boolean> {
  switch (text) {
    case "/preferences": await handlePreferences(db, chatId, clientId); return true;
    case "/save":        await handleSave(db, chatId, clientId);        return true;
    case "/saved":       await handleSaved(db, chatId, clientId);       return true;
    case "/list":        await handleList(db, chatId, clientId);        return true;
    case "/random":      await handleRandom(db, chatId, clientId);      return true;
    case "/week":        await handleWeek(db, chatId, clientId);        return true;
    default:             return false;
  }
}
