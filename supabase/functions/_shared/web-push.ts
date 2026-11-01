// deno-lint-ignore-file no-explicit-any
import webpush from "npm:web-push@3.6.7";

export type PushSub = { endpoint: string; p256dh: string; auth: string };

// Configure VAPID from env. Returns false if keys are missing so callers can skip.
export function configureWebPush(): boolean {
  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@chefbot.app";
  if (!pub || !priv) {
    console.warn("VAPID keys not set — skipping web push");
    return false;
  }
  try {
    webpush.setVapidDetails(subject, pub, priv);
    return true;
  } catch (err) {
    console.error("Failed to configure web push:", err);
    return false;
  }
}

// "gone" means the subscription is dead (404/410) and should be removed.
export async function sendPush(sub: PushSub, payload: object): Promise<"ok" | "gone" | "error"> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return "ok";
  } catch (err) {
    const status = (err as any)?.statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("web push send error:", status ?? err);
    return "error";
  }
}
