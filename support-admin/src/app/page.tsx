import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, chat_id, user_id, username, first_name, last_name, messages(id, text, created_at)")
    .order("created_at", { referencedTable: "messages", ascending: false })
    .limit(1, { referencedTable: "messages" });

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <p className="text-red-500 text-lg">Ошибка загрузки: {error.message}</p>
      </div>
    );
  }

  const chats = (clients ?? [])
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

          return (
            <Link
              key={client.id}
              href={`/chat/${client.id}`}
              className="flex items-center gap-4 bg-white rounded-2xl border border-gray-200/80 px-5 py-4 shadow-sm hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {display[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {display}
                  </p>
                  <time className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                    {time}
                  </time>
                </div>
                <p className="text-sm text-gray-500 truncate mt-0.5">
                  {lastMsg.text}
                </p>
              </div>
            </Link>
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
