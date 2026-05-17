// deno-lint-ignore-file no-explicit-any
import { answerCallback, removeKeyboard, sendMessage } from "../../_shared/api/telegram.ts";
import { findClientByChat } from "../api/clients.repo.ts";
import { addFavorite } from "../api/favorites.repo.ts";
import { getRecipeTitle } from "../api/recipes.repo.ts";
import { insertClientMessage } from "../api/messages.repo.ts";
import { gatherChatContext } from "../lib/context.ts";
import { processRecipeRequest } from "./recipe-reply.ts";

type CallbackQuery = {
  id: string;
  data: string;
  message: { chat: { id: number }; message_id: number };
};

export async function handleCallbackQuery(db: any, query: CallbackQuery): Promise<void> {
  const { id: queryId, data, message: { chat: { id: chatId }, message_id: messageId } } = query;

  const client = await findClientByChat(db, chatId);
  if (!client) {
    await answerCallback(queryId);
    return;
  }

  if (data.startsWith("rate:")) {
    await handleRate(db, queryId, chatId, messageId, client.id, data);
    return;
  }
  if (data.startsWith("save:")) {
    await handleSave(db, queryId, client.id, data);
    return;
  }
  if (data.startsWith("clarify:")) {
    await handleClarify(db, queryId, chatId, messageId, client.id, data);
    return;
  }

  await answerCallback(queryId);
}

async function handleRate(
  db: any,
  queryId: string,
  chatId: number,
  messageId: number,
  clientId: number,
  data: string,
): Promise<void> {
  const [, recipeIdStr, ratingStr] = data.split(":");
  const recipeId = parseInt(recipeIdStr);
  const rating = parseInt(ratingStr);

  await db.from("recipe_ratings").upsert(
    { client_id: clientId, recipe_id: recipeId, rating },
    { onConflict: "client_id,recipe_id" },
  );

  await answerCallback(queryId, rating === 1 ? "Спасибо за оценку! 👍" : "Понял, учтём 👎");
  await removeKeyboard(chatId, messageId);
}

async function handleSave(
  db: any,
  queryId: string,
  clientId: number,
  data: string,
): Promise<void> {
  const recipeId = parseInt(data.split(":")[1]);
  const title = (await getRecipeTitle(db, recipeId)) ?? "Рецепт";
  const result = await addFavorite(db, clientId, recipeId, title);
  await answerCallback(queryId, result === "duplicate" ? "Уже в избранном ⭐" : "Сохранено в избранное ⭐");
}

async function handleClarify(
  db: any,
  queryId: string,
  chatId: number,
  messageId: number,
  clientId: number,
  data: string,
): Promise<void> {
  const selectedText = data.slice("clarify:".length);

  await insertClientMessage(db, {
    clientId,
    text: selectedText,
    telegramMessageId: null,
  });

  await removeKeyboard(chatId, messageId);
  await answerCallback(queryId);
  await sendMessage(chatId, `👉 ${selectedText}`);

  const { settings, systemPrompt, conversationHistory } = await gatherChatContext(db, clientId);

  await processRecipeRequest(db, {
    chatId,
    clientId,
    userText: selectedText,
    settings,
    systemPrompt,
    history: conversationHistory,
    contextQuery: selectedText,
  });
}
