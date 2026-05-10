// deno-lint-ignore-file no-explicit-any
import { sendMessage, answerCallback, removeKeyboard } from "../../_shared/api/telegram.ts";
import { processRecipeRequest } from "../_lib/recipe-flow.ts";
import type { ClientSettings } from "../../_shared/types/index.ts";

const DEFAULT_CHAT_SETTINGS = {
  model: "deepseek-chat",
  temperature: 0.8,
  max_tokens: 10000,
  system_prompt:
    "Ты Шеф — дружелюбный кулинарный помощник. Отвечай только на кулинарные темы. Учитывай сезонность и предлагай замены аллергенам. Никогда не используй символы *** или ## и любое другое markdown-форматирование. Используй только эмодзи и обычный текст.",
};

export async function handleCallbackQuery(
  db: any,
  query: {
    id: string;
    data: string;
    message: { chat: { id: number }; message_id: number };
  },
): Promise<void> {
  const { id: queryId, data, message: { chat: { id: chatId }, message_id: messageId } } = query;

  const { data: client } = await db.from("clients").select("id").eq("chat_id", chatId).maybeSingle();
  if (!client) {
    await answerCallback(queryId);
    return;
  }

  if (data.startsWith("rate:")) {
    const [, recipeIdStr, ratingStr] = data.split(":");
    const recipeId = parseInt(recipeIdStr);
    const rating = parseInt(ratingStr);
    await db.from("recipe_ratings").upsert(
      { client_id: client.id, recipe_id: recipeId, rating },
      { onConflict: "client_id,recipe_id" },
    );
    await answerCallback(queryId, rating === 1 ? "Спасибо за оценку! 👍" : "Понял, учтём 👎");
    await removeKeyboard(chatId, messageId);
    return;
  }

  if (data.startsWith("save:")) {
    const recipeId = parseInt(data.split(":")[1]);
    const { data: recipe } = await db.from("recipes").select("title").eq("id", recipeId).maybeSingle();
    const { error } = await db.from("client_favorite_recipes").insert({
      client_id: client.id,
      recipe_id: recipeId,
      title: recipe?.title ?? "Рецепт",
    });
    await answerCallback(queryId, error?.code === "23505" ? "Уже в избранном ⭐" : "Сохранено в избранное ⭐");
    return;
  }

  if (data.startsWith("clarify:")) {
    const selectedText = data.slice("clarify:".length);

    await db.from("messages").insert({
      client_id: client.id,
      text: selectedText,
      telegram_message_id: null,
    });

    await removeKeyboard(chatId, messageId);
    await answerCallback(queryId);
    await sendMessage(chatId, `👉 ${selectedText}`);

    const [settingsResult, prefsResult, historyResult] = await Promise.all([
      db.from("chat_settings").select("model, temperature, max_tokens, system_prompt").eq("client_id", client.id).maybeSingle(),
      db.from("client_preferences").select("dietary_notes").eq("client_id", client.id).maybeSingle(),
      db.from("messages").select("text, sender_type").eq("client_id", client.id).order("created_at", { ascending: false }).limit(10),
    ]);

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
    const conversationHistory = chronologicalHistory
      .slice(0, -1)
      .map((m: { text: string; sender_type: string }) => ({
        role: m.sender_type === "bot" ? "assistant" as const : "user" as const,
        content: m.text,
      }));

    await processRecipeRequest(db, chatId, client.id, selectedText, settings, systemPrompt, conversationHistory, selectedText);
    return;
  }

  await answerCallback(queryId);
}
