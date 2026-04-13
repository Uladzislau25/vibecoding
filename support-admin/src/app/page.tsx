import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: messages, error } = await supabase
    .from("messages")
    .select("id, text, created_at, client:clients!inner(id, chat_id, user_id, username, first_name, last_name)")
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <p className="text-red-500 text-lg">Ошибка загрузки: {error.message}</p>
      </div>
    );
  }

  const msgs = (messages ?? []).filter((m) => m.client != null);
  const totalMessages = msgs.length;
  const uniqueChats = new Set(msgs.map((m) => m.client!.id)).size;

  // Group by client id
  const grouped = msgs.reduce<Record<number, typeof msgs>>((acc, msg) => {
    const clientId = msg.client!.id;
    if (!acc[clientId]) acc[clientId] = [];
    acc[clientId].push(msg);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <div className="max-w-3xl mx-auto px-6 py-4">
        <div className="flex gap-6 text-sm text-gray-500">
          <span>
            Сообщений: <span className="font-medium text-gray-700">{totalMessages}</span>
          </span>
          <span>
            Пользователей: <span className="font-medium text-gray-700">{uniqueChats}</span>
          </span>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 pb-8 flex flex-col gap-10">
        {Object.entries(grouped).map(([clientId, chatMessages]) => {
          const client = chatMessages[0].client!;
          const display =
            client.first_name || client.username || `User ${clientId}`;
          return (
            <section key={clientId}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                  {display[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{display}</p>
                  <p className="text-xs text-gray-400">Chat ID: {client.chat_id}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {chatMessages.map((msg) => {
                  const c = msg.client!;
                  const name = [c.first_name, c.last_name]
                    .filter(Boolean)
                    .join(" ") || c.username || `User ${c.chat_id ?? c.id}`;
                  const time = new Date(msg.created_at).toLocaleString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={msg.id}
                      className="bg-white rounded-2xl border border-gray-200/80 px-5 py-4 shadow-sm"
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[15px] font-semibold text-gray-900">
                          {name}
                        </span>
                        <time className="text-xs text-gray-400 whitespace-nowrap">
                          {time}
                        </time>
                      </div>
                      <p className="mt-1.5 text-[15px] leading-relaxed text-gray-700">
                        {msg.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {msgs.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            Сообщений пока нет
          </div>
        )}
      </main>
    </div>
  );
}
