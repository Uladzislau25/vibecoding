import { createClient } from "@supabase/supabase-js";
import { Database } from "../_shared/database.types.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

const supabase = createClient<Database>(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

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
      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: message.chat.id,
            text: "Здравствуйте! Опишите вашу проблему, и мы поможем.",
          }),
        },
      );

      const resBody = await res.json();
      if (!resBody.ok) {
        console.error("Telegram API error:", resBody);
      }

      return new Response("OK", { status: 200 });
    }

    // Upsert client by chat_id
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

    if (clientError) {
      console.error("Failed to upsert client:", clientError);
      return new Response("OK", { status: 200 });
    }

    const { error: dbError } = await supabase.from("messages").insert({
      client_id: client.id,
      text: message.text,
    });

    if (dbError) {
      console.error("Failed to save message:", dbError);
    }

    const reply = `I got your message: "${message.text}" Hello`;

    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: message.chat.id,
          text: reply,
        }),
      },
    );

    const resBody = await res.json();
    if (!resBody.ok) {
      console.error("Telegram API error:", resBody);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response("OK", { status: 200 });
  }
});
