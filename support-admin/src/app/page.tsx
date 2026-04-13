import { supabase } from "@/lib/supabase";
import ChatCard from "@/app/components/chat-card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [clientsRes, managersRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, chat_id, user_id, username, first_name, last_name, messages(id, text, created_at), client_assignments(assigned_manager_id)")
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
      const ta = new Date(a.messages[0].created_at).getTime();
      const tb = new Date(b.messages[0].created_at).getTime();
      return tb - ta;
    });

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <div className="max-w-3xl mx-auto px-6 py-4">
        <div className="text-sm text-gray-500">
          Чатов: <span className="font-medium text-gray-700">{chats.length}</span>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 pb-8 flex flex-col gap-2">
        {chats.map((client) => {
          const display =
            [client.first_name, client.last_name].filter(Boolean).join(" ") ||
            client.username ||
            `User ${client.chat_id ?? client.id}`;
          const lastMsg = client.messages[0];
          const time = new Date(lastMsg.created_at).toLocaleString("ru-RU", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          const currentManagerId = client.client_assignments?.assigned_manager_id ?? null;

          return (
            <ChatCard
              key={client.id}
              clientId={client.id}
              display={display}
              lastMessageText={lastMsg.text}
              time={time}
              managers={managers}
              currentManagerId={currentManagerId}
            />
          );
        })}

        {chats.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            Чатов пока нет
          </div>
        )}
      </main>
    </div>
  );
}
