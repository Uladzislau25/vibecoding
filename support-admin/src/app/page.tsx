import { supabase } from "@/lib/supabase";
import { createSupabaseServer } from "@/lib/supabase-server";
import ChatList from "@/app/components/chat-list";
import Landing from "@/app/components/landing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Сообщения" };

export default async function Home() {
  const supabaseServer = await createSupabaseServer();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) return <Landing />;

  const [clientsRes, managersRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, chat_id, username, first_name, last_name, status, escalation_status, messages(id, text, created_at), client_assignments(assigned_manager_id)")
      .order("created_at", { referencedTable: "messages", ascending: false })
      .limit(1, { referencedTable: "messages" }),
    supabase.from("managers").select("id, name, position").order("name"),
  ]);

  if (clientsRes.error) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <p className="text-red-500 text-lg">Ошибка загрузки: {clientsRes.error.message}</p>
      </div>
    );
  }

  const managers = managersRes.data ?? [];
  const chats = (clientsRes.data ?? [])
    .filter((c) => c.messages.length > 0)
    .sort((a, b) => {
      // Escalated chats float to top
      const ea = a.escalation_status === "escalated" ? 2 : a.escalation_status === "manager_active" ? 1 : 0;
      const eb = b.escalation_status === "escalated" ? 2 : b.escalation_status === "manager_active" ? 1 : 0;
      if (ea !== eb) return eb - ea;
      const ta = new Date(a.messages[0].created_at).getTime();
      const tb = new Date(b.messages[0].created_at).getTime();
      return tb - ta;
    })
    .map((c) => ({
      id: c.id,
      display:
        [c.first_name, c.last_name].filter(Boolean).join(" ") ||
        c.username ||
        `User ${c.chat_id ?? c.id}`,
      lastMessageText: c.messages[0].text,
      time: new Date(c.messages[0].created_at).toLocaleString("ru-RU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      currentManagerId: c.client_assignments?.assigned_manager_id ?? null,
      status: c.status ?? null,
      escalationStatus: c.escalation_status ?? "normal",
    }));

  return <ChatList chats={chats} managers={managers} />;
}
