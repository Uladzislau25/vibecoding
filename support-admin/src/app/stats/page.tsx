import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "Статистика" };

export default async function StatsPage() {
  const { data, error } = await supabase
    .from("messages")
    .select("client_id, created_at, total_tokens, prompt_tokens, completion_tokens, clients(first_name, last_name, username, chat_id)")
    .eq("sender_type", "bot")
    .not("total_tokens", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-950 flex items-center justify-center">
        <p className="text-red-500 text-lg">Ошибка загрузки: {error.message}</p>
      </div>
    );
  }

  const messages = data ?? [];

  const totalTokens = messages.reduce((s, m) => s + (m.total_tokens ?? 0), 0);
  const totalPrompt = messages.reduce((s, m) => s + (m.prompt_tokens ?? 0), 0);
  const totalCompletion = messages.reduce((s, m) => s + (m.completion_tokens ?? 0), 0);
  const totalMessages = messages.length;

  // По дням (последние 30)
  const byDay: Record<string, number> = {};
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    byDay[d.toISOString().slice(0, 10)] = 0;
  }
  for (const m of messages) {
    const day = m.created_at.slice(0, 10);
    if (day in byDay) byDay[day] += m.total_tokens ?? 0;
  }
  const days = Object.entries(byDay);
  const maxDay = Math.max(...days.map(([, v]) => v), 1);

  // По клиентам (топ 10)
  const byClient: Record<number, { display: string; tokens: number; messages: number }> = {};
  for (const m of messages) {
    const id = m.client_id;
    if (!byClient[id]) {
      const c = m.clients as { first_name: string | null; last_name: string | null; username: string | null; chat_id: number } | null;
      const display = c
        ? [c.first_name, c.last_name].filter(Boolean).join(" ") || c.username || `User ${c.chat_id}`
        : `Client ${id}`;
      byClient[id] = { display, tokens: 0, messages: 0 };
    }
    byClient[id].tokens += m.total_tokens ?? 0;
    byClient[id].messages += 1;
  }
  const topClients = Object.entries(byClient)
    .sort(([, a], [, b]) => b.tokens - a.tokens)
    .slice(0, 10);
  const maxClient = topClients[0]?.[1].tokens ?? 1;

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-950">
      <main className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Всего токенов", value: totalTokens.toLocaleString("ru-RU") },
            { label: "Запросы (prompt)", value: totalPrompt.toLocaleString("ru-RU") },
            { label: "Ответы (completion)", value: totalCompletion.toLocaleString("ru-RU") },
            { label: "Bot-сообщений", value: totalMessages.toLocaleString("ru-RU") },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm px-5 py-4">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{s.label}</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Daily chart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm px-5 py-5">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Токены по дням (30 дней)</p>
          <div className="flex items-end gap-1 h-32">
            {days.map(([day, val]) => {
              const height = maxDay > 0 ? Math.max((val / maxDay) * 100, val > 0 ? 4 : 0) : 0;
              const label = new Date(day + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    className="w-full rounded-sm bg-blue-500 transition-all group-hover:bg-blue-600"
                    style={{ height: `${height}%`, minHeight: val > 0 ? 3 : 0 }}
                  />
                  {val > 0 && (
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                      {label}: {val.toLocaleString("ru-RU")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-gray-400 dark:text-gray-500">
            <span>{days[0]?.[0] ? new Date(days[0][0] + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : ""}</span>
            <span>{days[days.length - 1]?.[0] ? new Date(days[days.length - 1][0] + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : ""}</span>
          </div>
        </div>

        {/* Top clients */}
        {topClients.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Топ клиентов по токенам</p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {topClients.map(([id, client]) => (
                <div key={id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{client.display}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{client.messages} сообщений</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${(client.tokens / maxClient) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 tabular-nums w-20 text-right">
                      {client.tokens.toLocaleString("ru-RU")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.length === 0 && (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500">Данных пока нет</div>
        )}
      </main>
    </div>
  );
}
