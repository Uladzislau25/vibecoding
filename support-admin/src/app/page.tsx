import { supabase } from "@/shared/api/supabase-anon";
import { createSupabaseServer } from "@/shared/api/supabase-server";
import ChatList from "@/widgets/chat-list/ui/ChatList";
import Landing from "@/shared/ui/landing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Сообщения" };

export default async function Home() {
  const supabaseServer = await createSupabaseServer();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) return <Landing />;

  const [clientsRes, managersRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, chat_id, username, first_name, last_name, status, escalation_status, escalated_at, messages(id, text, created_at, sender_type), client_assignments(assigned_manager_id)"),
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
      const ea = a.escalation_status === "escalated" ? 2 : a.escalation_status === "manager_active" ? 1 : 0;
      const eb = b.escalation_status === "escalated" ? 2 : b.escalation_status === "manager_active" ? 1 : 0;
      if (ea !== eb) return eb - ea;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msgs_a = a.messages.sort((x: any, y: any) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msgs_b = b.messages.sort((x: any, y: any) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime());
      const ta = new Date(msgs_a[0].created_at).getTime();
      const tb = new Date(msgs_b[0].created_at).getTime();
      return tb - ta;
    })
    .map((c) => {
      const msgs = [...c.messages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      const lastNonClient = msgs.filter((m) => m.sender_type !== "client").at(-1);
      const unreadCount = lastNonClient
        ? msgs.filter(
            (m) =>
              m.sender_type === "client" &&
              new Date(m.created_at).getTime() > new Date(lastNonClient.created_at).getTime(),
          ).length
        : msgs.filter((m) => m.sender_type === "client").length;

      const sorted = msgs.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      return {
        id: c.id,
        display:
          [c.first_name, c.last_name].filter(Boolean).join(" ") ||
          c.username ||
          `User ${c.chat_id ?? c.id}`,
        lastMessageText: sorted[0].text,
        time: new Date(sorted[0].created_at).toLocaleString("ru-RU", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        currentManagerId: c.client_assignments?.assigned_manager_id ?? null,
        status: c.status ?? null,
        escalationStatus: c.escalation_status ?? "normal",
        escalatedAt: c.escalated_at ?? null,
        unreadCount,
      };
    });

  return <ChatList chats={chats} managers={managers} />;
}
