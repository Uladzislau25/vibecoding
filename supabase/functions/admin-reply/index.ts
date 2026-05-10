import { createAdminClient, createUserClient } from "../_shared/api/supabase.ts";
import { tgPost } from "../_shared/api/telegram.ts";
import { corsHeaders, jsonResponse } from "../_shared/lib/http.ts";

const REPLY_PREFIX = "👨‍🍳 Шеф-повар: ";
const MANAGER_JOINED_MESSAGE = "👨‍🍳 Шеф-повар: С вами сейчас работает наш специалист.";

const admin = createAdminClient();

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: object): Promise<boolean> {
  const res = await tgPost("sendMessage", { chat_id: chatId, text, reply_markup: replyMarkup });
  return res.ok as boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userClient = createUserClient(authHeader);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => null);
    const chatId = Number(body?.chatId);
    const managerId = Number(body?.managerId);
    const recipeId = body?.recipeId ? Number(body.recipeId) : null;
    let messageText = typeof body?.message === "string" ? body.message.trim() : "";

    if (!chatId || !managerId) {
      return jsonResponse({ error: "chatId and managerId are required" }, 400);
    }

    if (recipeId) {
      const { data: recipe } = await admin
        .from("recipes")
        .select("id, title, description")
        .eq("id", recipeId)
        .maybeSingle();
      if (!recipe) return jsonResponse({ error: "Recipe not found" }, 404);
      messageText = recipe.description ?? recipe.title;
    }

    if (!messageText) {
      return jsonResponse({ error: "message or recipeId is required" }, 400);
    }

    const { data: manager, error: managerError } = await admin
      .from("managers")
      .select("id, name, user_id")
      .eq("id", managerId)
      .maybeSingle();

    if (managerError || !manager) {
      return jsonResponse({ error: "Manager not found" }, 403);
    }

    if (manager.user_id !== userData.user.id) {
      return jsonResponse({ error: "Manager does not match auth user" }, 403);
    }

    const { data: client, error: clientError } = await admin
      .from("clients")
      .select("id, chat_id, escalation_status")
      .eq("id", chatId)
      .maybeSingle();

    if (clientError || !client) {
      return jsonResponse({ error: "Client not found" }, 404);
    }

    const { data: assignment } = await admin
      .from("client_assignments")
      .select("assigned_manager_id")
      .eq("client_id", client.id)
      .maybeSingle();

    if (assignment?.assigned_manager_id !== managerId) {
      return jsonResponse({ error: "Manager is not assigned to this client" }, 403);
    }

    if (client.escalation_status === "escalated") {
      await admin.from("clients").update({ escalation_status: "manager_active" }).eq("id", client.id);
      await sendTelegramMessage(client.chat_id, MANAGER_JOINED_MESSAGE);
    }

    const { error: insertError } = await admin.from("messages").insert({
      client_id: client.id,
      text: messageText,
      sender_type: "manager",
      manager_id: managerId,
      recipe_id: recipeId ?? null,
    });

    if (insertError) {
      console.error("Failed to save manager message:", insertError);
      return jsonResponse({ error: "Failed to save message" }, 500);
    }

    const recipeKeyboard = recipeId ? {
      inline_keyboard: [[
        { text: "👍", callback_data: `rate:${recipeId}:1` },
        { text: "👎", callback_data: `rate:${recipeId}:-1` },
        { text: "⭐ Сохранить", callback_data: `save:${recipeId}` },
      ]],
    } : undefined;

    const tgOk = await sendTelegramMessage(
      client.chat_id,
      recipeId ? messageText : `${REPLY_PREFIX}${messageText}`,
      recipeKeyboard,
    );

    if (!tgOk) return jsonResponse({ error: "Telegram delivery failed" }, 502);

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("admin-reply error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
