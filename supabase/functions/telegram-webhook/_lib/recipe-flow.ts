// deno-lint-ignore-file no-explicit-any
import { createEmbedding } from "../../_shared/embeddings.ts";
import { sendMessage, sendTyping, recipeKeyboard, clarifyKeyboard } from "../../_shared/api/telegram.ts";
import { stripMarkdown, extractServings } from "../../_shared/lib/text.ts";
import { generateRecipe } from "./deepseek.ts";
import type { TokenUsage, ConversationMessage, ClientSettings } from "../../_shared/types/index.ts";

const ESCALATION_MESSAGE =
  "👨‍🍳 Шеф-повар: К сожалению, я не смогу помочь с этим запросом. С вами свяжется наш специалист в ближайшее время.";

export async function saveBotReply(
  db: any,
  clientId: number,
  text: string,
  recipeId: number | null = null,
  usage: TokenUsage = { prompt_tokens: null, completion_tokens: null, total_tokens: null },
): Promise<void> {
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

export async function processRecipeRequest(
  db: any,
  chatId: number,
  clientId: number,
  text: string,
  settings: ClientSettings,
  systemPromptBase: string,
  history: ConversationMessage[],
  contextQuery: string,
): Promise<void> {
  const servings = extractServings(text);
  const systemPrompt = servings
    ? `${systemPromptBase}\n\nПользователь хочет рецепт на ${servings} порций.`
    : systemPromptBase;

  await sendTyping(chatId);

  let reply: string;
  let replyRecipeId: number | null = null;
  let usage: TokenUsage = { prompt_tokens: null, completion_tokens: null, total_tokens: null };
  let escalated = false;
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
      }
    }
  } catch (err) {
    console.error("Failed to build reply:", err);
    reply = "Извините, сейчас не получается подобрать рецепт. Попробуйте, пожалуйста, чуть позже.";
  }

  reply = stripMarkdown(reply);

  if (clarifyOptions.length > 0) {
    await sendMessage(chatId, reply, clarifyKeyboard(clarifyOptions));
  } else if (replyRecipeId !== null) {
    await sendMessage(chatId, reply, recipeKeyboard(replyRecipeId));
  } else {
    await sendMessage(chatId, reply);
  }

  await saveBotReply(db, clientId, reply, replyRecipeId, usage);

  if (escalated) {
    await db
      .from("clients")
      .update({ escalation_status: "escalated", escalated_at: new Date().toISOString() })
      .eq("id", clientId);
  }
}
