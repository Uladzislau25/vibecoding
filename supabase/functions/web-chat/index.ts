// deno-lint-ignore-file no-explicit-any
//
// Web chat endpoint for the PWA. Mirrors the Telegram bot's recipe flow but
// speaks JSON instead of Telegram. Auth is a Supabase user JWT (verify_jwt=true);
// the recipe "brain" is shared with the bot via buildRecipeReply.

import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../_shared/api/supabase.ts";
import { corsHeaders, jsonResponse } from "../_shared/lib/http.ts";
import { extractServings, stripMarkdown } from "../_shared/lib/text.ts";
import { deriveContextQuery, gatherChatContext } from "../telegram-webhook/lib/context.ts";
import { withServings } from "../telegram-webhook/lib/prompt.ts";
import { buildRecipeReply } from "../telegram-webhook/features/recipe-reply.ts";
import { insertBotMessage, insertClientMessage } from "../telegram-webhook/api/messages.repo.ts";
import { markEscalated } from "../telegram-webhook/api/clients.repo.ts";

const admin = createAdminClient();

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
    // Persist the user's message first so it is part of the gathered history.
    await insertClientMessage(admin, { clientId, text, telegramMessageId: null });

    const { settings, systemPrompt, conversationHistory, chronologicalHistory } =
      await gatherChatContext(admin, clientId);

    const servings = extractServings(text);
    const prompt = withServings(systemPrompt, servings);

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
