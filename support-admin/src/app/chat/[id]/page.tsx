import { supabase } from "@/lib/supabase";
import { createSupabaseServer } from "@/lib/supabase-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import ChatSettingsPanel from "@/app/components/chat-settings-panel";
import MessagesList from "./messages-list";
import ReplyForm from "./reply-form";
import ChatAssignBar from "./chat-assign-bar";
import ReturnToBotButton from "./return-to-bot-button";
import RecipePicker from "./recipe-picker";
import ClientTags from "./client-tags";
import type { ChatSettingsInput } from "@/app/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await supabase
    .from("clients")
    .select("username, first_name, last_name, chat_id")
    .eq("id", Number(id))
    .single();

  if (!data) return { title: "Чат" };
  const name =
    [data.first_name, data.last_name].filter(Boolean).join(" ") ||
    data.username ||
    `User ${data.chat_id ?? id}`;
  return { title: name };
}

const DEFAULT_SETTINGS: ChatSettingsInput = {
  model: "deepseek-chat",
  max_tokens: 10000,
};

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clientId = Number(id);

  const [clientRes, messagesRes, settingsRes, assignmentRes, allManagersRes, sentRecipesRes] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).single(),
      supabase
        .from("messages")
        .select("id, text, created_at, sender_type, manager_id, total_tokens")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("chat_settings")
        .select("model, max_tokens")
        .eq("client_id", clientId)
        .maybeSingle(),
      supabase
        .from("client_assignments")
        .select("assigned_manager_id")
        .eq("client_id", clientId)
        .maybeSingle(),
      supabase.from("managers").select("id, name, position").order("name"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("messages")
        .select("recipe_id, created_at, recipes(title)")
        .eq("client_id", clientId)
        .not("recipe_id", "is", null)
        .order("created_at", { ascending: false }),
    ]);

  if (clientRes.error || !clientRes.data) return notFound();

  const client = clientRes.data;
  const messages = (messagesRes.data ?? []).map((m) => ({
    id: m.id,
    text: m.text,
    created_at: m.created_at,
    sender_type: (m.sender_type as "client" | "manager" | "bot" | "note") ?? "client",
    manager_id: m.manager_id,
    total_tokens: m.total_tokens,
  }));

  const totalTokens = messages.reduce(
    (sum, m) => sum + (m.total_tokens ?? 0),
    0,
  );

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

  const allManagers = (allManagersRes.data ?? []) as { id: number; name: string; position: string }[];
  const assignedManagerId = assignmentRes.data?.assigned_manager_id ?? null;
  const isAssigned = !!currentManager && currentManager.id === assignedManagerId;
  const showReturnToBot =
    client.escalation_status === "escalated" ||
    client.escalation_status === "manager_active";

  if (currentManager && !managerNames[currentManager.id]) {
    managerNames[currentManager.id] = currentManager.name;
  }

  const settingsRow = settingsRes.data;
  const initialSettings: ChatSettingsInput = {
    model:
      (settingsRow?.model as ChatSettingsInput["model"]) ??
      DEFAULT_SETTINGS.model,
    max_tokens: settingsRow?.max_tokens ?? DEFAULT_SETTINGS.max_tokens,
  };
  const initialStatus: "open" | "closed" =
    client.status === "closed" ? "closed" : "open";
  const display =
    [client.first_name, client.last_name].filter(Boolean).join(" ") ||
    client.username ||
    `User ${client.chat_id ?? client.id}`;

  type SentRecipe = { recipe_id: number; title: string; sent_at: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sentRecipes: SentRecipe[] = ((sentRecipesRes as any).data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.recipe_id != null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => ({
      recipe_id: r.recipe_id as number,
      title: (r.recipes as { title?: string } | null)?.title ?? "Рецепт",
      sent_at: r.created_at as string,
    }));

  const clientTags: string[] = (client as Record<string, unknown>).tags as string[] ?? [];

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
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
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {display[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{display}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {client.username ? `@${client.username}` : `Chat ID: ${client.chat_id}`}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a
              href={`/api/export/${clientId}`}
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Скачать историю чата"
            >
              ↓ CSV
            </a>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Токены
              </p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                {totalTokens.toLocaleString("ru-RU")}
              </p>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="mt-3">
          <ClientTags clientId={clientId} initialTags={clientTags} />
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 pb-8 flex flex-col gap-3">
        <ChatSettingsPanel
          clientId={clientId}
          initialSettings={initialSettings}
          initialStatus={initialStatus}
        />

        <ChatAssignBar
          clientId={clientId}
          managers={allManagers}
          currentManagerId={assignedManagerId}
          currentUserId={currentManager?.id ?? null}
        />

        {showReturnToBot && (
          <div className="flex justify-end">
            <ReturnToBotButton clientId={clientId} />
          </div>
        )}

        {isAssigned && currentManager ? (
          <div className="flex flex-col gap-2">
            <div className="flex justify-end">
              <RecipePicker clientId={clientId} managerId={currentManager.id} />
            </div>
            <ReplyForm clientId={clientId} managerId={currentManager.id} />
          </div>
        ) : (
          <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-3">
            {assignedManagerId
              ? "Ответить может только назначенный менеджер"
              : "Назначьте менеджера, чтобы ответить клиенту"}
          </div>
        )}

        {/* Sent recipes history */}
        {sentRecipes.length > 0 && (
          <details className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden">
            <summary className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none flex items-center justify-between">
              <span>📖 Отправленные рецепты ({sentRecipes.length})</span>
            </summary>
            <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
              {sentRecipes.map((r, i) => (
                <div key={`${r.recipe_id}-${i}`} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{r.title}</span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
                    {new Date(r.sent_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          </details>
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
