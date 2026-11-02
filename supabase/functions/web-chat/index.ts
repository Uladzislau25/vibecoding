// deno-lint-ignore-file no-explicit-any
//
// Web chat endpoint for the PWA. Mirrors the Telegram bot's recipe flow but
// speaks JSON instead of Telegram. Auth is a Supabase user JWT (verify_jwt=true);
// the recipe "brain" is shared with the bot via buildRecipeReply.

import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../_shared/api/supabase.ts";
import { corsHeaders, jsonResponse } from "../_shared/lib/http.ts";
import { detectCasual, extractServings, pickRandom, stripMarkdown } from "../_shared/lib/text.ts";
import { deriveContextQuery, gatherChatContext } from "../telegram-webhook/lib/context.ts";
import { withServings } from "../telegram-webhook/lib/prompt.ts";
import { buildRecipeReply } from "../telegram-webhook/features/recipe-reply.ts";
import { generateWeekPlan, suggestDishes } from "../telegram-webhook/api/deepseek.ts";
import { insertBotMessage, insertClientMessage } from "../telegram-webhook/api/messages.repo.ts";
import { markEscalated } from "../telegram-webhook/api/clients.repo.ts";
import { FAREWELL_REPLIES, GRATITUDE_REPLIES, GREETING_REPLIES } from "../telegram-webhook/_config.ts";

const admin = createAdminClient();

// Per-user daily cap on inbound messages to bound DeepSeek spend.
const DAILY_MESSAGE_LIMIT = 60;

// Web-only persona tweak: the PWA chat reads as a conversation, so make the
// clarifying questions warmer and chattier than the terse Telegram ones. Only
// the `question` field is affected — the recipe JSON schema stays strict.
const WEB_CHATTY_CLARIFY =
  "\n\nЭто чат в приложении, а не Telegram. Когда уточняешь детали (need_clarification), " +
  "пиши вопрос тепло и по-дружески, на «ты», с лёгким эмодзи и короткой живой фразой — " +
  "будто болтаешь с другом на кухне (например: «О, отличная идея! 😋 А какой суп больше хочется —…»). " +
  "Это касается только поля question; остальной JSON и формат рецепта не меняй.";

type WebUserMeta = { firstName: string | null; username: string | null };

// Find (or lazily create) the clients row backing this web user.
async function resolveWebClient(authUserId: string, meta: WebUserMeta): Promise<number | null> {
  const { data: existing } = await admin
    .from("clients")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("platform", "web")
    .maybeSingle();
  if (existing) return (existing as { id: number }).id;

  const { data: inserted, error } = await admin
    .from("clients")
    .insert({
      platform: "web",
      auth_user_id: authUserId,
      first_name: meta.firstName,
      username: meta.username,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("Failed to create web client:", error);
    return null;
  }
  return (inserted as { id: number }).id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

  // Resolve the user from their JWT (verify_jwt already guaranteed it is valid).
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return jsonResponse({ error: "text is required" }, 400);
  const mode = body?.mode === "suggest"
    ? "suggest"
    : body?.mode === "weekplan"
    ? "weekplan"
    : "recipe";

  const meta: WebUserMeta = {
    firstName:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null,
    username: user.email ?? null,
  };

  const clientId = await resolveWebClient(user.id, meta);
  if (clientId === null) return jsonResponse({ error: "Failed to resolve account" }, 500);

  try {
    // Daily quota: cap how many messages a single web user can send per day so a
    // runaway client can't rack up DeepSeek costs. Counted before persisting the
    // current message.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("sender_type", "client")
      .gte("created_at", since);
    if ((count ?? 0) >= DAILY_MESSAGE_LIMIT) {
      const reply =
        "На сегодня достигнут лимит запросов 🙏 Возвращайтесь завтра — продолжим готовить!";
      return jsonResponse({ text: reply, recipeId: null, clarifyOptions: [], suggestions: [], escalated: false });
    }

    // Persist the user's message first so it is part of the gathered history.
    await insertClientMessage(admin, { clientId, text, telegramMessageId: null });

    // "What can I cook from these products?" flow: the user pasted a list of
    // ingredients and wants dish ideas, not a full recipe. We answer with a few
    // suggestions; picking one later runs the normal recipe engine.
    if (mode === "suggest") {
      const { settings, systemPrompt } = await gatherChatContext(admin, clientId);
      const result = await suggestDishes(
        settings.model,
        systemPrompt,
        text,
        settings.temperature,
        settings.max_tokens,
      );

      if (!result.can_help) {
        const reply =
          "Хм, не похоже на список продуктов 🤔 Напишите, что у вас есть — например: «курица, рис, морковь, лук».";
        await insertBotMessage(admin, clientId, reply);
        return jsonResponse({
          text: reply,
          recipeId: null,
          clarifyOptions: [],
          suggestions: [],
          products: text,
          escalated: false,
        });
      }

      const intro = "Вот что можно приготовить из этих продуктов — выберите блюдо, и пришлю рецепт:";
      const historyText = intro + "\n\n" +
        result.suggestions.map((s) => `• ${s.title} — ${s.description}`).join("\n");
      await insertBotMessage(admin, clientId, historyText, null, result.usage);

      return jsonResponse({
        text: intro,
        recipeId: null,
        clarifyOptions: [],
        suggestions: result.suggestions,
        products: text,
        escalated: false,
      });
    }

    // Weekly meal plan: a dedicated generator (not the recipe engine), honouring
    // the user's dietary preferences.
    if (mode === "weekplan") {
      const { data: pref } = await admin
        .from("client_preferences")
        .select("dietary_notes")
        .eq("client_id", clientId)
        .maybeSingle();
      const plan = stripMarkdown(
        await generateWeekPlan((pref as { dietary_notes?: string } | null)?.dietary_notes ?? null),
      );
      await insertBotMessage(admin, clientId, plan);
      return jsonResponse({
        text: plan,
        recipeId: null,
        clarifyOptions: [],
        suggestions: [],
        escalated: false,
      });
    }

    // Greetings / thanks / goodbyes: reply casually instead of running the recipe
    // engine (which would escalate a "Привет" as a non-culinary request).
    const casual = detectCasual(text);
    if (casual) {
      const reply = casual === "greeting"
        ? pickRandom(GREETING_REPLIES)
        : casual === "gratitude"
        ? pickRandom(GRATITUDE_REPLIES)
        : pickRandom(FAREWELL_REPLIES);
      await insertBotMessage(admin, clientId, reply);
      return jsonResponse({ text: reply, recipeId: null, clarifyOptions: [], escalated: false });
    }

    const { settings, systemPrompt, conversationHistory, chronologicalHistory } =
      await gatherChatContext(admin, clientId);

    const servings = extractServings(text);
    const prompt = withServings(systemPrompt, servings) + WEB_CHATTY_CLARIFY;

    const draft = await buildRecipeReply(admin, {
      userText: text,
      settings,
      history: conversationHistory,
      contextQuery: deriveContextQuery(chronologicalHistory, text),
    }, prompt);

    const replyText = stripMarkdown(draft.text);
    await insertBotMessage(admin, clientId, replyText, draft.recipeId, draft.usage);
    if (draft.escalated) await markEscalated(admin, clientId);

    return jsonResponse({
      text: replyText,
      recipeId: draft.recipeId,
      clarifyOptions: draft.clarifyOptions,
      escalated: draft.escalated,
    });
  } catch (err) {
    console.error("web-chat error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
