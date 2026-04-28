import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import ChatSettingsPanel from "@/app/components/chat-settings-panel";
import MessagesList from "./messages-list";
import type { ChatSettingsInput } from "@/app/actions";

export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS: ChatSettingsInput = {
  model: "deepseek-chat",
  temperature: 0.8,
  max_tokens: 1000,
  system_prompt:
    "Ты Шеф - дружелюбный кулинарный помощник. Отвечай только на кулинарные темы, давай рецепты в формате: Наазвание, Ингредиенты, Пошаговые инструкции, Время приготовления. Учитывай сезонность и предлагай замены аллергенам. Считай каллоррии, белки, жиры, углеводы.",
};

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clientId = Number(id);

  const [clientRes, messagesRes, settingsRes] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).single(),
    supabase
      .from("messages")
      .select("id, text, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true }),
    supabase
      .from("chat_settings")
      .select("model, temperature, max_tokens, system_prompt")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);

  if (clientRes.error || !clientRes.data) return notFound();

  const client = clientRes.data;
  const messages = messagesRes.data ?? [];
  const settingsRow = settingsRes.data;
  const initialSettings: ChatSettingsInput = {
    model:
      (settingsRow?.model as ChatSettingsInput["model"]) ??
      DEFAULT_SETTINGS.model,
    temperature: settingsRow?.temperature ?? DEFAULT_SETTINGS.temperature,
    max_tokens: settingsRow?.max_tokens ?? DEFAULT_SETTINGS.max_tokens,
    system_prompt: settingsRow?.system_prompt ?? DEFAULT_SETTINGS.system_prompt,
  };
  const initialStatus: "open" | "closed" =
    client.status === "closed" ? "closed" : "open";
  const display =
    [client.first_name, client.last_name].filter(Boolean).join(" ") ||
    client.username ||
    `User ${client.chat_id ?? client.id}`;

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <div className="max-w-3xl mx-auto px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Назад"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
            {display[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{display}</p>
            <p className="text-xs text-gray-400">
              {client.username ? `@${client.username}` : `Chat ID: ${client.chat_id}`}
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 pb-8 flex flex-col gap-3">
        <ChatSettingsPanel
          clientId={clientId}
          initialSettings={initialSettings}
          initialStatus={initialStatus}
        />

        <MessagesList
          clientId={clientId}
          displayName={display}
          initialMessages={messages}
        />
      </main>
    </div>
  );
}
