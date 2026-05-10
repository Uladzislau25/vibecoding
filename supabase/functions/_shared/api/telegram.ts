const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const MAX_TG_LEN = 4096;

export const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "🎲 Случайный рецепт" }, { text: "⭐ Избранное" }],
    [{ text: "🛒 Список покупок" }, { text: "⚙️ Предпочтения" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

export function recipeKeyboard(recipeId: number) {
  return {
    inline_keyboard: [[
      { text: "👍", callback_data: `rate:${recipeId}:1` },
      { text: "👎", callback_data: `rate:${recipeId}:-1` },
      { text: "⭐ Сохранить", callback_data: `save:${recipeId}` },
    ]],
  };
}

export function clarifyKeyboard(options: string[]) {
  return {
    inline_keyboard: options.map((opt) => [{
      text: opt,
      callback_data: `clarify:${opt.slice(0, 28)}`,
    }]),
  };
}

export async function tgPost(method: string, body: object): Promise<{ ok: boolean; [key: string]: unknown }> {
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  const json = await res.json();
  if (!json.ok) console.error(`Telegram ${method} error:`, json);
  return json;
}

export async function sendMessage(chatId: number, text: string, replyMarkup: object = MAIN_KEYBOARD) {
  const safe = text.length > MAX_TG_LEN ? text.slice(0, MAX_TG_LEN - 3) + "..." : text;
  return tgPost("sendMessage", { chat_id: chatId, text: safe, reply_markup: replyMarkup });
}

export async function sendTyping(chatId: number) {
  return tgPost("sendChatAction", { chat_id: chatId, action: "typing" });
}

export async function answerCallback(callbackQueryId: string, text?: string) {
  return tgPost("answerCallbackQuery", { callback_query_id: callbackQueryId, text, show_alert: false });
}

export async function removeKeyboard(chatId: number, messageId: number) {
  return tgPost("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}
