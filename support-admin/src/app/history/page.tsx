import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "История" };

const ACTION_LABEL: Record<string, { text: string; className: string }> = {
  assigned: {
    text: "назначен",
    className: "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
  },
  unassigned: {
    text: "снят",
    className: "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  },
};

export default async function HistoryPage() {
  const { data, error } = await supabase
    .from("messages_managers")
    .select(
      "id, action, created_at, manager:managers(id, name), client:clients(id, chat_id, username, first_name, last_name)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-950 flex items-center justify-center">
        <p className="text-red-500 text-lg">
          Ошибка загрузки: {error.message}
        </p>
      </div>
    );
  }

  const events = data ?? [];

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-950">
      <main className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-4">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Событий:{" "}
          <span className="font-medium text-gray-700 dark:text-gray-300">{events.length}</span>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Менеджер</th>
                <th className="text-left px-4 py-3 font-medium">Чат</th>
                <th className="text-left px-4 py-3 font-medium">Действие</th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  Дата
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const manager = e.manager;
                const client = e.client;
                const chatLabel = client
                  ? [client.first_name, client.last_name]
                      .filter(Boolean)
                      .join(" ") ||
                    client.username ||
                    `User ${client.chat_id ?? client.id}`
                  : "—";
                const action = e.action ? ACTION_LABEL[e.action] : null;
                const date = e.created_at
                  ? new Date(e.created_at).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—";

                return (
                  <tr
                    key={e.id}
                    className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                      {manager?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{chatLabel}</td>
                    <td className="px-4 py-3">
                      {action ? (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-md border ${action.className}`}
                        >
                          {action.text}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-xs">
                          {e.action ?? "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {date}
                    </td>
                  </tr>
                );
              })}
              {events.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-gray-400 dark:text-gray-500 text-sm"
                  >
                    Событий пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
