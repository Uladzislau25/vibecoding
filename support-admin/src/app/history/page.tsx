import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, { text: string; className: string }> = {
  assigned: {
    text: "назначен",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  unassigned: {
    text: "снят",
    className: "bg-gray-50 text-gray-600 border-gray-200",
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
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <p className="text-red-500 text-lg">
          Ошибка загрузки: {error.message}
        </p>
      </div>
    );
  }

  const events = data ?? [];

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <main className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-4">
        <div className="text-xs text-gray-500">
          Событий:{" "}
          <span className="font-medium text-gray-700">{events.length}</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
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
                    className="border-t border-gray-100 hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3 text-gray-900">
                      {manager?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{chatLabel}</td>
                    <td className="px-4 py-3">
                      {action ? (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-md border ${action.className}`}
                        >
                          {action.text}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">
                          {e.action ?? "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {date}
                    </td>
                  </tr>
                );
              })}
              {events.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-gray-400 text-sm"
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
