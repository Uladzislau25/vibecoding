// deno-lint-ignore-file no-explicit-any
import { createAdminClient } from "../_shared/api/supabase.ts";
import { detectCasual, pickRandom } from "../_shared/lib/text.ts";
import { sendMessage } from "../_shared/api/telegram.ts";
import { processRecipeRequest, saveBotReply } from "./_lib/recipe-flow.ts";
import { handleCallbackQuery } from "./_handlers/callback.ts";
import {
  handleStart,
  handlePreferences,
  handleSave,
  handleSaved,
  handleList,
  handleRandom,
  handleWeek,
} from "./_handlers/commands.ts";
import type { ClientSettings, ConversationMessage } from "../_shared/types/index.ts";

const RATE_LIMIT_PER_HOUR = 20;

const DEFAULT_CHAT_SETTINGS = {
  model: "deepseek-chat",
  temperature: 0.8,
  max_tokens: 10000,
  system_prompt:
    "Ты Шеф — дружелюбный кулинарный помощник. Отвечай только на кулинарные темы. Учитывай сезонность и предлагай замены аллергенам. Никогда не используй символы *** или ## и любое другое markdown-форматирование. Используй только эмодзи и обычный текст.",
};

const GREETING_REPLIES = [
  "Привет! Я Шеф — ваш кулинарный помощник 👨‍🍳 Что будем готовить сегодня?",
  "Здравствуйте! Готов помочь с рецептом. Что хотите приготовить? 🍽️",
  "Привет! Расскажите, что хочется приготовить — подберу рецепт 😊",
  "Добро пожаловать! Назовите блюдо, и я пришлю рецепт с ингредиентами и пошаговыми инструкциями 👨‍🍳",
];
const GRATITUDE_REPLIES = [
  "Пожалуйста! Приятного аппетита 😊 Если понадобится ещё рецепт — обращайтесь!",
  "Рад помочь! Готовьте с удовольствием 🍽️",
  "Всегда пожалуйста! Буду ждать новых кулинарных вопросов 👨‍🍳",
];
const FAREWELL_REPLIES = [
  "До свидания! Возвращайтесь, когда захотите что-нибудь приготовить 👨‍🍳",
  "Пока-пока! Приятного аппетита и до встречи 🍽️",
  "До скорого! Буду ждать ваших кулинарных вопросов 😊",
];

const BUTTON_COMMAND_MAP: Record<string, string> = {
  "🎲 Случайный рецепт": "/random",
  "⭐ Избранное": "/saved",
  "🛒 Список покупок": "/list",
  "⚙️ Предпочтения": "/preferences",
};

const db = createAdminClient() as any;

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("OK", { status: 200 });

    const update = await req.json();

    if (update.callback_query) {
      await handleCallbackQuery(db, update.callback_query);
      return new Response("OK", { status: 200 });
    }

    const message = update.message;
    if (!message?.text) return new Response("OK", { status: 200 });

    const rawText = message.text.trim();
    const chatId: number = message.chat.id;
    const text = BUTTON_COMMAND_MAP[rawText] ?? rawText;

    console.log(`Message from ${message.from?.first_name} (${message.from?.id}): ${text}`);

    if (text === "/start") {
      await handleStart(chatId);
      return new Response("OK", { status: 200 });
    }

    const { data: client, error: clientError } = await db
      .from("clients")
      .upsert(
        {
          chat_id: chatId,
          user_id: message.from.id,
          username: message.from.username ?? null,
          first_name: message.from.first_name ?? null,
          last_name: message.from.last_name ?? null,
        },
        { onConflict: "chat_id" },
      )
      .select("id, escalation_status, setup_state")
      .single();

    if (clientError || !client) {
      console.error("Failed to upsert client:", clientError);
      return new Response("OK", { status: 200 });
    }

    const { data: clientFull } = await db
      .from("clients")
      .select("status")
      .eq("id", client.id)
      .single();
    if (clientFull?.status === "closed") {
      await db.from("clients").update({ status: "open" }).eq("id", client.id);
    }

    const { error: msgError } = await db.from("messages").insert({
      client_id: client.id,
      text,
      telegram_message_id: message.message_id,
    });

    if (msgError) {
      if (msgError.code === "23505") return new Response("OK", { status: 200 });
      console.error("Failed to save message:", msgError);
      return new Response("OK", { status: 200 });
    }

    if (client.escalation_status === "escalated" || client.escalation_status === "manager_active") {
      return new Response("OK", { status: 200 });
    }

    if (text === "/preferences") {
      await handlePreferences(db, chatId, client.id);
      return new Response("OK", { status: 200 });
    }
    if (text === "/save") {
      await handleSave(db, chatId, client.id);
      return new Response("OK", { status: 200 });
    }
    if (text === "/saved") {
      await handleSaved(db, chatId, client.id);
      return new Response("OK", { status: 200 });
    }
    if (text === "/list") {
      await handleList(db, chatId, client.id);
      return new Response("OK", { status: 200 });
    }
    if (text === "/random") {
      await handleRandom(db, chatId, client.id);
      return new Response("OK", { status: 200 });
    }
    if (text === "/week") {
      await handleWeek(db, chatId, client.id);
      return new Response("OK", { status: 200 });
    }

    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count: hourlyCount } = await db
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("sender_type", "client")
      .gte("created_at", oneHourAgo);

    if ((hourlyCount ?? 0) > RATE_LIMIT_PER_HOUR) {
      await sendMessage(chatId, "⏳ Слишком много запросов. Пожалуйста, немного подождите перед следующим вопросом.");
      return new Response("OK", { status: 200 });
    }

    const [settingsResult, prefsResult, historyResult] = await Promise.all([
      db.from("chat_settings").select("model, temperature, max_tokens, system_prompt").eq("client_id", client.id).maybeSingle(),
      db.from("client_preferences").select("dietary_notes").eq("client_id", client.id).maybeSingle(),
      db.from("messages").select("text, sender_type").eq("client_id", client.id).order("created_at", { ascending: false }).limit(10),
    ]);

    if (client.setup_state === "awaiting_preferences") {
      const notes = text.toLowerCase() === "нет" ? null : text;
      await Promise.all([
        notes
          ? db.from("client_preferences").upsert(
              { client_id: client.id, dietary_notes: notes, updated_at: new Date().toISOString() },
              { onConflict: "client_id" },
            )
          : db.from("client_preferences").delete().eq("client_id", client.id),
        db.from("clients").update({ setup_state: null }).eq("id", client.id),
      ]);
      const reply = notes
        ? `✅ Сохранено! Буду учитывать: ${notes}\n\nВсе рецепты будут адаптированы под ваши предпочтения.`
        : "✅ Ограничения сброшены. Буду предлагать любые рецепты.";
      await sendMessage(chatId, reply);
      await saveBotReply(db, client.id, reply);
      return new Response("OK", { status: 200 });
    }

    const casualType = detectCasual(text);
    if (casualType) {
      if (client.setup_state) {
        await db.from("clients").update({ setup_state: null }).eq("id", client.id);
      }
      const reply =
        casualType === "greeting" ? pickRandom(GREETING_REPLIES) :
        casualType === "gratitude" ? pickRandom(GRATITUDE_REPLIES) :
        pickRandom(FAREWELL_REPLIES);
      await sendMessage(chatId, reply);
      await saveBotReply(db, client.id, reply);
      return new Response("OK", { status: 200 });
    }

    const settingsRow = settingsResult.data;
    const settings: ClientSettings = {
      model: settingsRow?.model ?? DEFAULT_CHAT_SETTINGS.model,
      temperature: settingsRow?.temperature ?? DEFAULT_CHAT_SETTINGS.temperature,
      max_tokens: settingsRow?.max_tokens ?? DEFAULT_CHAT_SETTINGS.max_tokens,
      system_prompt: settingsRow?.system_prompt ?? DEFAULT_CHAT_SETTINGS.system_prompt,
    };

    const dietaryNotes = prefsResult.data?.dietary_notes;
    const systemPrompt = dietaryNotes
      ? `${settings.system_prompt}\n\nПользователь указал предпочтения: ${dietaryNotes}. Всегда учитывай это при составлении рецептов.`
      : settings.system_prompt;

    const chronologicalHistory = (historyResult.data ?? []).reverse();
    const conversationHistory: ConversationMessage[] = chronologicalHistory
      .slice(0, -1)
      .map((m: { text: string; sender_type: string }) => ({
        role: m.sender_type === "bot" ? "assistant" as const : "user" as const,
        content: m.text,
      }));

    const contextQuery = chronologicalHistory
      .filter((m: { sender_type: string }) => m.sender_type === "client")
      .slice(-2)
      .map((m: { text: string }) => m.text)
      .join(" ") || text;

    await processRecipeRequest(db, chatId, client.id, text, settings, systemPrompt, conversationHistory, contextQuery);

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response("OK", { status: 200 });
  }
});
