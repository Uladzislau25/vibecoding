
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

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

    const reply = `I got your message: "${message.text}" — loud and clear!`;

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
