import { createClient } from "@supabase/supabase-js";
import { Database } from "../_shared/database.types.ts";
import { createEmbedding } from "../_shared/embeddings.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;

const DEFAULT_CHAT_SETTINGS = {
  model: "deepseek-chat",
  temperature: 0.8,
  max_tokens: 10000,
  system_prompt:
    "Ты Шеф - дружелюбный кулинарный помощник. Отвечай только на кулинарные темы, давай рецепты в формате: Название, Ингредиенты, Пошаговые инструкции, Время приготовления. Учитывай сезонность и предлагай замены аллергенам. Считай калории, белки, жиры, углеводы.",
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

function detectCasual(text: string): "gratitude" | "farewell" | null {
  const lower = text.toLowerCase().trim();
  if (GRATITUDE_KEYWORDS.some((kw) => lower.includes(kw))) return "gratitude";
  if (FAREWELL_KEYWORDS.some((kw) => lower.includes(kw))) return "farewell";
  return null;
}

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

const supabase = createClient<Database>(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function sendTelegramMessage(chatId: number, text: string) {
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    },
  );
  const body = await res.json();
  if (!body.ok) console.error("Telegram sendMessage error:", body);
}

async function sendTypingAction(chatId: number) {
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
    },
  );
  const body = await res.json();
  if (!body.ok) console.error("Telegram sendChatAction error:", body);
}

type TokenUsage = {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
};

type GeneratedRecipe = {
  can_help: boolean;
  title: string;
  ingredients: string;
  instructions: string;
  reply_text: string;
  usage: TokenUsage;
};

const JSON_SCHEMA_INSTRUCTION = `
Верни ответ строго в формате JSON:
{
  "can_help": true,
  "title": "краткое название рецепта (до 256 символов)",
  "ingredients": "список ингредиентов с количествами, по одному на строку",
  "instructions": "пошаговые инструкции приготовления",
  "reply_text": "полный готовый ответ пользователю (название, ингредиенты, шаги, время, КБЖУ)"
}
Если запрос не относится к кулинарии или ты не можешь помочь — верни:
{"can_help": false, "title": "", "ingredients": "", "instructions": "", "reply_text": ""}
Никакого текста вне JSON. Только валидный JSON.`;

async function generateRecipeWithDeepSeek(
  model: string,
  systemPrompt: string,
  userMessage: string,
  temperature: number,
  maxTokens: number,
): Promise<GeneratedRecipe> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt + "\n\n" + JSON_SCHEMA_INSTRUCTION },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`DeepSeek error: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  const content = body.choices[0].message.content;
  const parsed = JSON.parse(content) as Partial<GeneratedRecipe>;

  const u = body.usage ?? {};
  const usage: TokenUsage = {
    prompt_tokens: typeof u.prompt_tokens === "number" ? u.prompt_tokens : null,
    completion_tokens:
      typeof u.completion_tokens === "number" ? u.completion_tokens : null,
    total_tokens: typeof u.total_tokens === "number" ? u.total_tokens : null,
  };

  return {
    can_help: parsed.can_help !== false,
    title: (parsed.title ?? "Рецепт").slice(0, 256),
    ingredients: parsed.ingredients ?? "",
    instructions: parsed.instructions ?? "",
    reply_text: parsed.reply_text ?? content,
    usage,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("OK", { status: 200 });
    }

    const update = await req.json();
    const message = update.message;

    if (!message?.text) {
      return new Response("OK", { status: 200 });
    }

    console.log(
      `Message from ${message.from?.first_name} (${message.from?.id}): ${message.text}`,
    );

    if (message.text.trim() === "/start") {
      await sendTelegramMessage(
        message.chat.id,
        "Привет! Я Шеф — ваш кулинарный помощник 👨‍🍳\n\n" +
          "Расскажите, что хотите приготовить, или просто назовите блюдо — пришлю рецепт с ингредиентами, пошаговыми инструкциями, временем готовки и КБЖУ.\n\n" +
          "Учитываю сезонность и подскажу замены, если есть аллергии или непереносимость.\n\n" +
          "Например: «борщ», «что приготовить из курицы и риса», «лёгкий ужин на двоих».",
      );
      return new Response("OK", { status: 200 });
    }

    // Gratitude and farewell — respond warmly, do not save to database
    const casualType = detectCasual(message.text);
    if (casualType) {
      const reply = casualType === "gratitude"
        ? pickRandom(GRATITUDE_REPLIES)
        : pickRandom(FAREWELL_REPLIES);
      await sendTelegramMessage(message.chat.id, reply);
      return new Response("OK", { status: 200 });
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .upsert(
        {
          chat_id: message.chat.id,
          user_id: message.from.id,
          username: message.from.username ?? null,
          first_name: message.from.first_name ?? null,
          last_name: message.from.last_name ?? null,
        },
        { onConflict: "chat_id" },
      )
      .select("id, escalation_status")
      .single();

    if (clientError || !client) {
      console.error("Failed to upsert client:", clientError);
      return new Response("OK", { status: 200 });
    }

    // Always save the incoming user message
    const { error: dbError } = await supabase
      .from("messages")
      .insert({
        client_id: client.id,
        text: message.text,
      });

    if (dbError) {
      console.error("Failed to save message:", dbError);
      return new Response("OK", { status: 200 });
    }

    // Bot is paused while manager is handling this chat
    if (
      client.escalation_status === "escalated" ||
      client.escalation_status === "manager_active"
    ) {
      return new Response("OK", { status: 200 });
    }

    const { data: settingsRow } = await supabase
      .from("chat_settings")
      .select("model, temperature, max_tokens, system_prompt")
      .eq("client_id", client.id)
      .maybeSingle();

    const settings = {
      model: settingsRow?.model ?? DEFAULT_CHAT_SETTINGS.model,
      temperature: settingsRow?.temperature ?? DEFAULT_CHAT_SETTINGS.temperature,
      max_tokens: settingsRow?.max_tokens ?? DEFAULT_CHAT_SETTINGS.max_tokens,
      system_prompt: settingsRow?.system_prompt ??
        DEFAULT_CHAT_SETTINGS.system_prompt,
    };

    await sendTypingAction(message.chat.id);

    let reply: string;
    let usage: TokenUsage = {
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
    };
    let escalated = false;

    try {
      const queryEmbedding = await createEmbedding(message.text, "query");
      const queryEmbeddingLiteral = JSON.stringify(queryEmbedding);

      const { data: matches, error: searchError } = await supabase.rpc(
        "search_recipes",
        { query_embedding: queryEmbeddingLiteral, match_count: 1 },
      );

      if (searchError) {
        console.error("search_recipes error:", searchError);
      }

      if (matches && matches.length > 0) {
        const recipe = matches[0];
        reply = `${recipe.title}\n\n${recipe.description}`;
      } else {
        const generated = await generateRecipeWithDeepSeek(
          settings.model,
          settings.system_prompt,
          message.text,
          settings.temperature,
          settings.max_tokens,
        );
        usage = generated.usage;

        if (!generated.can_help) {
          escalated = true;
          reply = ESCALATION_MESSAGE;
        } else {
          const { data: existing } = await supabase
            .from("recipes")
            .select("description, title")
            .ilike("title", generated.title.trim())
            .limit(1)
            .maybeSingle();

          if (existing) {
            reply = existing.description ?? generated.reply_text;
          } else {
            const passageInput = [
              generated.title,
              generated.reply_text,
              generated.ingredients,
              generated.instructions,
            ].filter(Boolean).join("\n\n");
            const passageEmbedding = await createEmbedding(passageInput, "passage");

            const { error: insertError } = await supabase.from("recipes").insert({
              title: generated.title,
              description: generated.reply_text,
              ingredients: generated.ingredients,
              instructions: generated.instructions,
              embedding: JSON.stringify(passageEmbedding),
            });

            if (insertError) {
              console.error("Failed to save recipe:", insertError);
            }

            reply = generated.reply_text;
          }
        }
      }
    } catch (err) {
      console.error("Failed to build reply:", err);
      reply =
        "Извините, сейчас не получается подобрать рецепт. Попробуйте, пожалуйста, чуть позже.";
    }

    await sendTelegramMessage(message.chat.id, reply);

    const { error: botInsertError } = await supabase.from("messages").insert({
      client_id: client.id,
      text: reply,
      sender_type: "bot",
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
    });
    if (botInsertError) {
      console.error("Failed to save bot reply:", botInsertError);
    }

    if (escalated) {
      const { error: escalateError } = await supabase
        .from("clients")
        .update({ escalation_status: "escalated" })
        .eq("id", client.id);
      if (escalateError) {
        console.error("Failed to set escalation_status:", escalateError);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response("OK", { status: 200 });
  }
});
