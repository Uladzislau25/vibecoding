import { createClient } from "@supabase/supabase-js";
import { Database } from "../_shared/database.types.ts";
import { createEmbedding } from "../_shared/embeddings.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY") ?? "";
const RATE_LIMIT_PER_HOUR = 20;

const DEFAULT_CHAT_SETTINGS = {
  model: "deepseek-chat",
  temperature: 0.8,
  max_tokens: 10000,
  system_prompt:
    "Ты Шеф — дружелюбный кулинарный помощник. Отвечай только на кулинарные темы. Учитывай сезонность и предлагай замены аллергенам. Никогда не используй символы *** или ## и любое другое markdown-форматирование. Используй только эмодзи и обычный текст.",
};

const ESCALATION_MESSAGE =
  "👨‍🍳 Шеф-повар: К сожалению, я не смогу помочь с этим запросом. С вами свяжется наш специалист в ближайшее время.";

const GRATITUDE_KEYWORDS = [
  "спасибо", "спс", "благодарю", "благодарствую", "пасиб", "пасибо",
  "сяб", "thanks", "thank you", "thx",
];
const FAREWELL_KEYWORDS = [
  "пока", "до свидания", "до встречи", "всего доброго", "до скорого",
  "прощай", "прощайте", "бай", "bye", "goodbye", "увидимся", "до завтра",
  "всего хорошего", "счастливо",
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

const RECIPE_CATEGORIES = [
  "Супы", "Салаты", "Основные блюда", "Десерты",
  "Завтраки", "Закуски", "Выпечка", "Напитки", "Другое",
];

// Persistent reply keyboard shown for all non-inline messages
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "🎲 Случайный рецепт" }, { text: "⭐ Избранное" }],
    [{ text: "🛒 Список покупок" }, { text: "⚙️ Предпочтения" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

function detectCasual(text: string): "gratitude" | "farewell" | null {
  const lower = text.toLowerCase().trim();
  if (GRATITUDE_KEYWORDS.some((kw) => lower.includes(kw))) return "gratitude";
  if (FAREWELL_KEYWORDS.some((kw) => lower.includes(kw))) return "farewell";
  return null;
}

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Detect "на X человек/порций/персон" in user text
function extractServings(text: string): number | null {
  const match = text.match(/на\s+(\d+)\s*(человек|порци[ий]|персон)/i);
  return match ? parseInt(match[1]) : null;
}

function stripMarkdown(text: string): string {
  return text.replace(/\*+/g, "").replace(/^#+\s*/gm, "").trim();
}

// deno-lint-ignore no-explicit-any
const db = createClient<Database>(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
// deno-lint-ignore no-explicit-any
) as any;

// ─── Telegram helpers ────────────────────────────────────────────────────────

async function tgPost(method: string, body: object) {
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  const json = await res.json();
  if (!json.ok) console.error(`Telegram ${method} error:`, json);
  return json;
}

const MAX_TG_LEN = 4096;

// Default reply_markup is MAIN_KEYBOARD for all plain messages
async function sendMessage(chatId: number, text: string, replyMarkup: object = MAIN_KEYBOARD) {
  const safe = text.length > MAX_TG_LEN ? text.slice(0, MAX_TG_LEN - 3) + "..." : text;
  return tgPost("sendMessage", { chat_id: chatId, text: safe, reply_markup: replyMarkup });
}

async function sendPhoto(chatId: number, photoUrl: string, caption: string, replyMarkup: object) {
  return tgPost("sendPhoto", {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    reply_markup: replyMarkup,
  });
}

async function sendTyping(chatId: number) {
  return tgPost("sendChatAction", { chat_id: chatId, action: "typing" });
}

async function answerCallback(callbackQueryId: string, text?: string) {
  return tgPost("answerCallbackQuery", { callback_query_id: callbackQueryId, text, show_alert: false });
}

async function removeKeyboard(chatId: number, messageId: number) {
  return tgPost("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}

function recipeKeyboard(recipeId: number) {
  return {
    inline_keyboard: [[
      { text: "👍", callback_data: `rate:${recipeId}:1` },
      { text: "👎", callback_data: `rate:${recipeId}:-1` },
      { text: "⭐ Сохранить", callback_data: `save:${recipeId}` },
    ]],
  };
}

function clarifyKeyboard(options: string[]) {
  return {
    inline_keyboard: options.map((opt) => [{
      text: opt,
      // callback_data limit: 64 bytes UTF-8; "clarify:" = 8 bytes, Cyrillic = 2 bytes/char → 28 chars max
      callback_data: `clarify:${opt.slice(0, 28)}`,
    }]),
  };
}

// ─── Unsplash ─────────────────────────────────────────────────────────────────

async function fetchUnsplashPhoto(query: string): Promise<string | null> {
  if (!PEXELS_API_KEY) return null;
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
    const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
    if (!res.ok) return null;
    const body = await res.json();
    return (body.photos?.[0]?.src?.large as string) ?? null;
  } catch {
    return null;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type TokenUsage = {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
};

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type GeneratedRecipe = {
  need_clarification: boolean;
  question: string;
  options: string[];
  can_help: boolean;
  title: string;
  category: string;
  ingredients: string;
  instructions: string;
  reply_text: string;
  usage: TokenUsage;
};

type ClientSettings = {
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
};

// ─── AI generation ───────────────────────────────────────────────────────────

const CATEGORY_LIST = RECIPE_CATEGORIES.join(", ");

const JSON_SCHEMA_INSTRUCTION = `
Верни ответ строго в формате JSON. Возможны три варианта:

1. Если пользователь назвал блюдо без деталей (например просто "борщ", "паста", "пирог", "салат", "суп") — ОБЯЗАТЕЛЬНО уточни какой именно вариант он хочет. Предложи 3-4 конкретных варианта. Не более 3 уточнений подряд без рецепта:
{"need_clarification": true, "question": "твой вопрос", "options": ["Вариант 1", "Вариант 2", "Вариант 3"], "can_help": true, "title": "", "category": "", "ingredients": "", "instructions": "", "reply_text": ""}

2. Если деталей достаточно — дай рецепт:
{
  "need_clarification": false,
  "can_help": true,
  "title": "краткое название рецепта (до 256 символов)",
  "category": "одна из: ${CATEGORY_LIST}",
  "ingredients": "список ингредиентов с количествами, каждый с новой строки через • (например: • Свёкла — 300 г)",
  "instructions": "пошаговые инструкции, каждый шаг с новой строки пронумерован (например: 1. Нарезать...)",
  "reply_text": "полный ответ пользователю строго по шаблону:\\n🍽️ {название}\\n\\n🛒 Ингредиенты:\\n{ингредиенты через •}\\n\\n👨‍🍳 Приготовление:\\n{пронумерованные шаги}\\n\\n⏱️ Время приготовления: {время}\\n🍽️ Порций: {количество}\\n\\n📊 Пищевая ценность (на 1 порцию):\\n• Калории: {X} ккал\\n• Белки: {X} г\\n• Жиры: {X} г\\n• Углеводы: {X} г"
}

3. Если запрос не кулинарный:
{"need_clarification": false, "can_help": false, "title": "", "category": "", "ingredients": "", "instructions": "", "reply_text": ""}

Никакого текста вне JSON. Только валидный JSON. Никаких символов *** или ## в тексте.`;

async function generateRecipe(
  model: string,
  systemPrompt: string,
  history: ConversationMessage[],
  userMessage: string,
  temperature: number,
  maxTokens: number,
): Promise<GeneratedRecipe> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt + "\n\n" + JSON_SCHEMA_INSTRUCTION },
        ...history,
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek error: ${res.status} ${await res.text()}`);

  const body = await res.json();
  const content = body.choices[0].message.content;
  const parsed = JSON.parse(content) as Partial<GeneratedRecipe>;
  const u = body.usage ?? {};

  return {
    need_clarification: parsed.need_clarification === true,
    question: parsed.question ?? "",
    options: Array.isArray(parsed.options) ? parsed.options.slice(0, 6) : [],
    can_help: parsed.can_help !== false,
    title: (parsed.title ?? "Рецепт").slice(0, 256),
    category: RECIPE_CATEGORIES.includes(parsed.category ?? "") ? (parsed.category ?? "Другое") : "Другое",
    ingredients: parsed.ingredients ?? "",
    instructions: parsed.instructions ?? "",
    reply_text: parsed.reply_text ?? content,
    usage: {
      prompt_tokens: typeof u.prompt_tokens === "number" ? u.prompt_tokens : null,
      completion_tokens: typeof u.completion_tokens === "number" ? u.completion_tokens : null,
      total_tokens: typeof u.total_tokens === "number" ? u.total_tokens : null,
    },
  };
}

// Generate meal plan for 7 days via DeepSeek (plain text, no JSON schema)
async function generateWeekPlan(dietaryNotes: string | null | undefined): Promise<string> {
  const dietLine = dietaryNotes ? `Учитывай предпочтения пользователя: ${dietaryNotes}.` : "";
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.9,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content:
            "Ты Шеф — кулинарный помощник. Составь план питания на 7 дней (завтрак, обед, ужин). " +
            "Используй только эмодзи и обычный текст. Никаких *** или ## markdown. " +
            dietLine,
        },
        {
          role: "user",
          content: "Составь план питания на 7 дней с завтраком, обедом и ужином.",
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek week plan error: ${res.status}`);
  const body = await res.json();
  return body.choices[0].message.content as string;
}

// ─── Core recipe processing ───────────────────────────────────────────────────

async function processRecipeRequest(
  chatId: number,
  clientId: number,
  text: string,
  settings: ClientSettings,
  systemPromptBase: string,
  history: ConversationMessage[],
  contextQuery: string,
): Promise<void> {
  // Detect serving count override
  const servings = extractServings(text);
  const systemPrompt = servings
    ? `${systemPromptBase}\n\nПользователь хочет рецепт на ${servings} порций.`
    : systemPromptBase;

  await sendTyping(chatId);

  let reply: string;
  let replyRecipeId: number | null = null;
  let usage: TokenUsage = { prompt_tokens: null, completion_tokens: null, total_tokens: null };
  let escalated = false;
  let photoUrl: string | null = null;
  let clarifyOptions: string[] = [];

  try {
    const queryEmbedding = await createEmbedding(contextQuery, "query");
    const { data: matches, error: searchError } = await db.rpc("search_recipes", {
      query_embedding: JSON.stringify(queryEmbedding),
      query_text: contextQuery,
      match_count: 1,
    });

    if (searchError) console.error("search_recipes error:", searchError);

    if (matches && matches.length > 0 && matches[0].similarity >= 0.88) {
      const recipe = matches[0];
      reply = stripMarkdown(recipe.description ?? recipe.title);
      replyRecipeId = recipe.id;
    } else {
      const generated = await generateRecipe(
        settings.model,
        systemPrompt,
        history,
        text,
        settings.temperature,
        settings.max_tokens,
      );
      usage = generated.usage;

      if (generated.need_clarification) {
        clarifyOptions = generated.options;
        reply = generated.question;
      } else if (!generated.can_help) {
        escalated = true;
        reply = ESCALATION_MESSAGE;
      } else {
        const passageInput = [generated.title, generated.reply_text, generated.ingredients, generated.instructions]
          .filter(Boolean)
          .join("\n\n");
        const passageEmbedding = await createEmbedding(passageInput, "passage");

        const { data: newRecipe, error: insertError } = await db
          .from("recipes")
          .insert({
            title: generated.title,
            category: generated.category || null,
            description: generated.reply_text,
            ingredients: generated.ingredients,
            instructions: generated.instructions,
            embedding: JSON.stringify(passageEmbedding),
          })
          .select("id")
          .single();

        if (insertError) {
          if (insertError.code === "23505") {
            const { data: existing } = await db
              .from("recipes")
              .select("id, description")
              .ilike("title", generated.title.trim())
              .limit(1)
              .maybeSingle();
            reply = existing?.description ?? generated.reply_text;
            replyRecipeId = existing?.id ?? null;
          } else {
            console.error("Failed to save recipe:", insertError);
            reply = generated.reply_text;
          }
        } else {
          reply = generated.reply_text;
          replyRecipeId = newRecipe?.id ?? null;
        }

        // Photo sending disabled pending Telegram URL compatibility check
        void photoUrl;
      }
    }
  } catch (err) {
    console.error("Failed to build reply:", err);
    reply = "Извините, сейчас не получается подобрать рецепт. Попробуйте, пожалуйста, чуть позже.";
  }

  // Strip legacy markdown from all replies
  reply = stripMarkdown(reply);

  // Send response
  if (clarifyOptions.length > 0) {
    // Clarification: inline buttons for options, no MAIN_KEYBOARD (can't combine)
    await sendMessage(chatId, reply, clarifyKeyboard(clarifyOptions));
  } else if (replyRecipeId !== null) {
    await sendMessage(chatId, reply, recipeKeyboard(replyRecipeId));
  } else {
    await sendMessage(chatId, reply);
  }

  await saveBotReply(clientId, reply, replyRecipeId, usage);

  if (escalated) {
    await db.from("clients").update({ escalation_status: "escalated" }).eq("id", clientId);
  }
}

// ─── Callback query handler ───────────────────────────────────────────────────

async function handleCallbackQuery(query: {
  id: string;
  data: string;
  message: { chat: { id: number }; message_id: number };
}) {
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

    // Save the selected option as a client message
    await db.from("messages").insert({
      client_id: client.id,
      text: selectedText,
      telegram_message_id: null,
    });

    // Remove clarification keyboard from previous message
    await removeKeyboard(chatId, messageId);
    await answerCallback(queryId);

    // Echo the selected option so user sees their choice in chat
    await sendMessage(chatId, `👉 ${selectedText}`);

    // Load settings + preferences + history to run full recipe flow
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
    const conversationHistory: ConversationMessage[] = chronologicalHistory
      .slice(0, -1)
      .map((m: { text: string; sender_type: string }) => ({
        role: m.sender_type === "bot" ? "assistant" as const : "user" as const,
        content: m.text,
      }));

    await processRecipeRequest(
      chatId,
      client.id,
      selectedText,
      settings,
      systemPrompt,
      conversationHistory,
      selectedText,
    );
    return;
  }

  await answerCallback(queryId);
}

// ─── Bot reply helper ─────────────────────────────────────────────────────────

async function saveBotReply(
  clientId: number,
  text: string,
  recipeId: number | null = null,
  usage: TokenUsage = { prompt_tokens: null, completion_tokens: null, total_tokens: null },
) {
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

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("OK", { status: 200 });

    const update = await req.json();

    // Inline keyboard callbacks
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return new Response("OK", { status: 200 });
    }

    const message = update.message;
    if (!message?.text) return new Response("OK", { status: 200 });

    const rawText = message.text.trim();
    const chatId: number = message.chat.id;

    // Map reply keyboard buttons to commands
    const buttonCommandMap: Record<string, string> = {
      "🎲 Случайный рецепт": "/random",
      "⭐ Избранное": "/saved",
      "🛒 Список покупок": "/list",
      "⚙️ Предпочтения": "/preferences",
    };
    const text = buttonCommandMap[rawText] ?? rawText;

    console.log(`Message from ${message.from?.first_name} (${message.from?.id}): ${text}`);

    // /start — no DB needed, respond immediately
    if (text === "/start") {
      await sendMessage(
        chatId,
        "Привет! Я Шеф — ваш кулинарный помощник 👨‍🍳\n\n" +
          "Расскажите, что хотите приготовить, или просто назовите блюдо — пришлю рецепт с ингредиентами, пошаговыми инструкциями, временем готовки и КБЖУ.\n\n" +
          "🥗 Есть диетические ограничения или аллергии? Настройте через кнопку ⚙️ Предпочтения.\n\n" +
          "Команды:\n" +
          "/random — случайный рецепт 🎲\n" +
          "/week — план питания на 7 дней 📅\n" +
          "/save — сохранить последний рецепт ⭐\n" +
          "/saved — мои сохранённые рецепты\n" +
          "/list — список покупок для последнего рецепта 🛒\n" +
          "/preferences — мои пищевые предпочтения",
      );
      return new Response("OK", { status: 200 });
    }

    // Upsert client
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

    // Save user message (idempotency via telegram_message_id)
    const { error: msgError } = await db.from("messages").insert({
      client_id: client.id,
      text,
      telegram_message_id: message.message_id,
    });

    if (msgError) {
      if (msgError.code === "23505") {
        return new Response("OK", { status: 200 });
      }
      console.error("Failed to save message:", msgError);
      return new Response("OK", { status: 200 });
    }

    // Bot is paused while manager is handling
    if (client.escalation_status === "escalated" || client.escalation_status === "manager_active") {
      return new Response("OK", { status: 200 });
    }

    // ── Slash commands (no rate limit) ────────────────────────────────────────

    if (text === "/preferences") {
      await db.from("clients").update({ setup_state: "awaiting_preferences" }).eq("id", client.id);
      const reply =
        "✏️ Напишите ваши пищевые ограничения, аллергии или предпочтения.\n\n" +
        "Например: вегетарианец, без лактозы, не люблю острое\n\n" +
        "Или напишите «нет» чтобы сбросить.";
      await sendMessage(chatId, reply);
      await saveBotReply(client.id, reply);
      return new Response("OK", { status: 200 });
    }

    if (text === "/save") {
      const { data: lastMsg } = await db
        .from("messages")
        .select("recipe_id")
        .eq("client_id", client.id)
        .eq("sender_type", "bot")
        .not("recipe_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let reply: string;
      if (!lastMsg?.recipe_id) {
        reply = "Сначала попросите рецепт, потом сохраните его 🍽️";
      } else {
        const { data: recipe } = await db.from("recipes").select("title").eq("id", lastMsg.recipe_id).maybeSingle();
        const { error: saveErr } = await db.from("client_favorite_recipes").insert({
          client_id: client.id,
          recipe_id: lastMsg.recipe_id,
          title: recipe?.title ?? "Рецепт",
        });
        reply = saveErr?.code === "23505"
          ? "Этот рецепт уже в вашем избранном ⭐"
          : `⭐ Рецепт «${recipe?.title ?? ""}» сохранён!`;
      }
      await sendMessage(chatId, reply);
      await saveBotReply(client.id, reply);
      return new Response("OK", { status: 200 });
    }

    if (text === "/saved") {
      const { data: favorites } = await db
        .from("client_favorite_recipes")
        .select("title")
        .eq("client_id", client.id)
        .order("saved_at", { ascending: false })
        .limit(20);

      let reply: string;
      if (!favorites?.length) {
        reply =
          "У вас пока нет сохранённых рецептов.\n\nНажмите ⭐ под рецептом или используйте /save.";
      } else {
        const list = (favorites as { title: string }[]).map((f, i) => `${i + 1}. ${f.title}`).join("\n");
        reply = `⭐ Ваши сохранённые рецепты:\n\n${list}\n\nНапишите название любого блюда, чтобы получить его снова.`;
      }
      await sendMessage(chatId, reply);
      await saveBotReply(client.id, reply);
      return new Response("OK", { status: 200 });
    }

    if (text === "/list") {
      const { data: lastMsg } = await db
        .from("messages")
        .select("recipe_id")
        .eq("client_id", client.id)
        .eq("sender_type", "bot")
        .not("recipe_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let reply: string;
      if (!lastMsg?.recipe_id) {
        reply = "Сначала попросите рецепт, потом я составлю список покупок 🛒";
      } else {
        const { data: recipe } = await db
          .from("recipes")
          .select("title, ingredients")
          .eq("id", lastMsg.recipe_id)
          .maybeSingle();
        reply = recipe
          ? `🛒 Список покупок для «${recipe.title}»:\n\n${recipe.ingredients}`
          : "Не удалось найти рецепт. Попробуйте снова.";
      }
      await sendMessage(chatId, reply);
      await saveBotReply(client.id, reply);
      return new Response("OK", { status: 200 });
    }

    // /random — random recipe from DB
    if (text === "/random") {
      await sendTyping(chatId);
      const { data: randomRecipe } = await db
        .from("recipes")
        .select("id, title, description")
        .order("id", { ascending: false })
        .limit(100)
        .then(({ data }: { data: { id: number; title: string; description: string | null }[] | null }) => {
          if (!data || data.length === 0) return { data: null };
          const pick = data[Math.floor(Math.random() * data.length)];
          return { data: pick };
        });

      let reply: string;
      if (!randomRecipe) {
        reply = "Рецептов пока нет в базе. Попросите приготовить что-нибудь!";
        await sendMessage(chatId, reply);
        await saveBotReply(client.id, reply);
      } else {
        reply = randomRecipe.description ?? randomRecipe.title;
        await sendMessage(chatId, reply, recipeKeyboard(randomRecipe.id));
        await saveBotReply(client.id, reply, randomRecipe.id);
      }
      return new Response("OK", { status: 200 });
    }

    // /week — 7-day meal plan
    if (text === "/week") {
      await sendTyping(chatId);
      const { data: prefs } = await db
        .from("client_preferences")
        .select("dietary_notes")
        .eq("client_id", client.id)
        .maybeSingle();
      try {
        const plan = await generateWeekPlan(prefs?.dietary_notes);
        await sendMessage(chatId, plan);
        await saveBotReply(client.id, plan);
      } catch (err) {
        console.error("Week plan error:", err);
        const reply = "Не удалось составить план питания. Попробуйте позже.";
        await sendMessage(chatId, reply);
        await saveBotReply(client.id, reply);
      }
      return new Response("OK", { status: 200 });
    }

    // ── Rate limiting ─────────────────────────────────────────────────────────

    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count: hourlyCount } = await db
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("sender_type", "client")
      .gte("created_at", oneHourAgo);

    if ((hourlyCount ?? 0) > RATE_LIMIT_PER_HOUR) {
      const reply = "⏳ Слишком много запросов. Пожалуйста, немного подождите перед следующим вопросом.";
      await sendMessage(chatId, reply);
      return new Response("OK", { status: 200 });
    }

    // ── Load settings, preferences, history in parallel ───────────────────────

    const [settingsResult, prefsResult, historyResult] = await Promise.all([
      db.from("chat_settings").select("model, temperature, max_tokens, system_prompt").eq("client_id", client.id).maybeSingle(),
      db.from("client_preferences").select("dietary_notes").eq("client_id", client.id).maybeSingle(),
      db.from("messages").select("text, sender_type").eq("client_id", client.id).order("created_at", { ascending: false }).limit(10),
    ]);

    // ── Preferences setup flow ────────────────────────────────────────────────

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
      await saveBotReply(client.id, reply);
      return new Response("OK", { status: 200 });
    }

    // ── Casual messages ───────────────────────────────────────────────────────

    const casualType = detectCasual(text);
    if (casualType) {
      if (client.setup_state) {
        await db.from("clients").update({ setup_state: null }).eq("id", client.id);
      }
      const reply = casualType === "gratitude" ? pickRandom(GRATITUDE_REPLIES) : pickRandom(FAREWELL_REPLIES);
      await sendMessage(chatId, reply);
      return new Response("OK", { status: 200 });
    }

    // ── Recipe request ────────────────────────────────────────────────────────

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

    await processRecipeRequest(
      chatId,
      client.id,
      text,
      settings,
      systemPrompt,
      conversationHistory,
      contextQuery,
    );

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response("OK", { status: 200 });
  }
});
