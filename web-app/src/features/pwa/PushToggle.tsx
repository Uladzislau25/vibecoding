"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/shared/api/supabase-browser";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "unsupported" | "off" | "on" | "busy";

export default function PushToggle() {
  const [state, setState] = useState<State>("busy");

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !VAPID_PUBLIC_KEY
    ) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function enable() {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
      });
      const json = sub.toJSON();
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.rpc("save_push_subscription", {
        p_endpoint: sub.endpoint,
        p_p256dh: json.keys?.p256dh ?? "",
        p_auth: json.keys?.auth ?? "",
      });
      if (error) throw error;
      setState("on");
    } catch (err) {
      console.error("Push subscribe failed:", err);
      setState("off");
    }
  }

  async function disable() {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const supabase = getSupabaseBrowser();
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
      setState("on");
    }
  }

  if (state === "unsupported") {
    // Keep the control visible (don't silently vanish). On iOS, push is only
    // available in the installed PWA — hint the user to add it to the home screen.
    return (
      <button
        type="button"
        disabled
        title="Уведомления работают только в установленном приложении. Добавьте ChefBot на главный экран."
        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
      >
        🔕
      </button>
    );
  }

  const on = state === "on";
  return (
    <button
      type="button"
      disabled={state === "busy"}
      onClick={on ? disable : enable}
      title={on ? "Уведомления включены" : "Включить уведомления о рецепте дня"}
      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
    >
      {state === "busy" ? "…" : on ? "🔔 Вкл" : "🔕 Выкл"}
    </button>
  );
}
