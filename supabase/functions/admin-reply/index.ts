import { createClient } from "@supabase/supabase-js";
import { Database } from "../_shared/database.types.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const REPLY_PREFIX = "👨‍🍳 Шеф-повар: ";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    const userClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => null);
    const chatId = Number(body?.chatId);
    const messageText = typeof body?.message === "string" ? body.message.trim() : "";
    const managerId = Number(body?.managerId);

    if (!chatId || !messageText || !managerId) {
      return jsonResponse(
        { error: "chatId, message and managerId are required" },
        400,
      );
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
      .select("id, chat_id")
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
      return jsonResponse(
        { error: "Manager is not assigned to this client" },
        403,
      );
    }

    const { error: insertError } = await admin.from("messages").insert({
      client_id: client.id,
      text: messageText,
      sender_type: "manager",
      manager_id: managerId,
    });

    if (insertError) {
      console.error("Failed to save manager message:", insertError);
      return jsonResponse({ error: "Failed to save message" }, 500);
    }

    const tgRes = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: client.chat_id,
          text: `${REPLY_PREFIX}${messageText}`,
        }),
      },
    );

    const tgBody = await tgRes.json();
    if (!tgBody.ok) {
      console.error("Telegram sendMessage error:", tgBody);
      return jsonResponse(
        { error: "Telegram delivery failed", details: tgBody },
        502,
      );
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("admin-reply error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
