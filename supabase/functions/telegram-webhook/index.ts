import { createClient } from "@supabase/supabase-js";
import { Database } from "../_shared/database.types.ts";
import { createEmbedding } from "../_shared/embeddings.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;

const DEFAULT_CHAT_SETTINGS = {
  model: "deepseek-chat",
  temperature: 0.8,
  max_tokens: 1000,
  system_prompt:
    "Ты Шеф - дружелюбный кулинарный помощник. Отвечай только на кулинарные темы, давай рецепты в формате: Название, Ингредиенты, Пошаговые инструкции, Время приготовления. Учитывай сезонность и предлагай замены аллергенам. Считай калории, белки, жиры, углеводы.",
};

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

type GeneratedRecipe = {
  title: string;
  ingredients: string;
  instructions: string;
  reply_text: string;
};

const JSON_SCHEMA_INSTRUCTION = `
Верни ответ строго в формате JSON со следующими полями:
{
  "title": "краткое название рецепта (до 256 символов)",
  "ingredients": "список ингредиентов с количествами, по одному на строку",
  "instructions": "пошаговые инструкции приготовления",
  "reply_text": "полный готовый ответ пользователю в свободной форме (название, ингредиенты, шаги, время, КБЖУ — всё, что обычно)"
}
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

  return {
    title: (parsed.title ?? "Рецепт").slice(0, 256),
    ingredients: parsed.ingredients ?? "",
    instructions: parsed.instructions ?? "",
    reply_text: parsed.reply_text ?? content,
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
      .select("id")
      .single();

    if (clientError || !client) {
      console.error("Failed to upsert client:", clientError);
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

    await sendTypingAction(message.chat.id);

    let reply: string;
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
          const passageEmbedding = await createEmbedding(
            passageInput,
            "passage",
          );

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
    } catch (err) {
      console.error("Failed to build reply:", err);
      reply =
        "Извините, сейчас не получается подобрать рецепт. Попробуйте, пожалуйста, чуть позже.";
    }

    await sendTelegramMessage(message.chat.id, reply);

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response("OK", { status: 200 });
  }
});
