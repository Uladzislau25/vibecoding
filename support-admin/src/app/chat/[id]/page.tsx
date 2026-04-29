import { supabase } from "@/lib/supabase";
import { createSupabaseServer } from "@/lib/supabase-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import ChatSettingsPanel from "@/app/components/chat-settings-panel";
import MessagesList from "./messages-list";
import ReplyForm from "./reply-form";
import type { ChatSettingsInput } from "@/app/actions";

export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS: ChatSettingsInput = {
  model: "deepseek-chat",
  temperature: 0.8,
  max_tokens: 10000,
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

  const [clientRes, messagesRes, settingsRes, assignmentRes] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).single(),
      supabase
        .from("messages")
        .select("id, text, created_at, sender_type, manager_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("chat_settings")
        .select("model, temperature, max_tokens, system_prompt")
        .eq("client_id", clientId)
        .maybeSingle(),
      supabase
        .from("client_assignments")
        .select("assigned_manager_id")
        .eq("client_id", clientId)
        .maybeSingle(),
    ]);

  if (clientRes.error || !clientRes.data) return notFound();

  const client = clientRes.data;
  const messages = (messagesRes.data ?? []).map((m) => ({
    id: m.id,
    text: m.text,
    created_at: m.created_at,
    sender_type: (m.sender_type as "client" | "manager" | "bot") ?? "client",
    manager_id: m.manager_id,
  }));

  const managerIds = Array.from(
    new Set(messages.map((m) => m.manager_id).filter((v): v is number => !!v)),
  );
  const { data: managersRows } = managerIds.length
    ? await supabase.from("managers").select("id, name").in("id", managerIds)
    : { data: [] as { id: number; name: string }[] };
  const managerNames: Record<number, string> = Object.fromEntries(
    (managersRows ?? []).map((m) => [m.id, m.name]),
  );

  const supabaseSrv = await createSupabaseServer();
  const {
    data: { user },
  } = await supabaseSrv.auth.getUser();
  const { data: currentManager } = user
    ? await supabaseSrv
        .from("managers")
        .select("id, name")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const assignedManagerId = assignmentRes.data?.assigned_manager_id ?? null;
  const isAssigned =
    !!currentManager && currentManager.id === assignedManagerId;

  if (currentManager && !managerNames[currentManager.id]) {
    managerNames[currentManager.id] = currentManager.name;
  }

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

        {isAssigned && currentManager ? (
          <ReplyForm clientId={clientId} managerId={currentManager.id} />
        ) : (
          <div className="text-center text-xs text-gray-400 py-3">
            {assignedManagerId
              ? "Ответить может только назначенный менеджер"
              : "Назначьте менеджера, чтобы ответить клиенту"}
          </div>
        )}

        <MessagesList
          clientId={clientId}
          clientName={display}
          managerNames={managerNames}
          initialMessages={messages}
        />
      </main>
    </div>
  );
}
