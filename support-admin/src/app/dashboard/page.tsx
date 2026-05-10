import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "Дашборд" };

export default async function DashboardPage() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Run all queries in parallel
  const [
    messagesResult,
    topRecipesResult,
    totalClientsResult,
    activeClientsResult,
    totalRecipesResult,
    managerStatsResult,
  ] = await Promise.all([
    // Messages per day for last 7 days
    supabase
      .from("messages")
      .select("created_at")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: true }),

    // Top 5 recipes by net rating (👍 - 👎)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("recipe_ratings")
      .select("recipe_id, rating, recipes(title)"),

    // Total clients
    supabase.from("clients").select("id", { count: "exact", head: true }),

    // Active clients (had messages in last 7 days)
    supabase
      .from("messages")
      .select("client_id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo)
      .eq("sender_type", "client"),

    // Total recipes
    supabase.from("recipes").select("id", { count: "exact", head: true }),

    // Manager activity last 30 days
    supabase
      .from("messages")
      .select("manager_id, client_id, managers(name)")
      .eq("sender_type", "manager")
      .gte("created_at", thirtyDaysAgo),
  ]);

  // Build messages-per-day map
  const byDay: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    byDay[d.toISOString().slice(0, 10)] = 0;
  }
  for (const m of messagesResult.data ?? []) {
    const day = (m.created_at as string).slice(0, 10);
    if (day in byDay) byDay[day]++;
  }
  const days = Object.entries(byDay);
  const maxDayCount = Math.max(...days.map(([, v]) => v), 1);

  // Aggregate top recipes
  type RatingRow = { recipe_id: number; rating: number; recipes: { title: string } | null };
  const ratingsData = (topRecipesResult.data ?? []) as RatingRow[];
  const recipeScores: Record<number, { title: string; up: number; down: number; net: number }> = {};
  for (const r of ratingsData) {
    if (!recipeScores[r.recipe_id]) {
      recipeScores[r.recipe_id] = { title: r.recipes?.title ?? "Без названия", up: 0, down: 0, net: 0 };
    }
    if (r.rating === 1) recipeScores[r.recipe_id].up++;
    else recipeScores[r.recipe_id].down++;
  }
  for (const v of Object.values(recipeScores)) v.net = v.up - v.down;
  const topRecipes = Object.entries(recipeScores)
    .sort(([, a], [, b]) => b.net - a.net)
    .slice(0, 5);

  // Manager stats aggregation
  type MgrRow = { manager_id: number | null; client_id: number; managers: { name: string } | null };
  const mgrRows = (managerStatsResult.data ?? []) as MgrRow[];
  const mgrMap: Record<number, { name: string; messages: number; chats: Set<number> }> = {};
  for (const r of mgrRows) {
    if (!r.manager_id) continue;
    if (!mgrMap[r.manager_id]) {
      mgrMap[r.manager_id] = { name: r.managers?.name ?? "Менеджер", messages: 0, chats: new Set() };
    }
    mgrMap[r.manager_id].messages++;
    mgrMap[r.manager_id].chats.add(r.client_id);
  }
  const managerStats = Object.values(mgrMap)
    .map((m) => ({ name: m.name, messages: m.messages, chats: m.chats.size }))
    .sort((a, b) => b.messages - a.messages);

  const totalClients = totalClientsResult.count ?? 0;
  const activeClients = activeClientsResult.count ?? 0;
  const totalRecipes = totalRecipesResult.count ?? 0;
  const totalMessages7d = days.reduce((s, [, v]) => s + v, 0);

  const statCards = [
    { label: "Всего пользователей", value: totalClients.toLocaleString("ru-RU") },
    { label: "Активных за 7 дней", value: activeClients.toLocaleString("ru-RU") },
    { label: "Рецептов в базе", value: totalRecipes.toLocaleString("ru-RU") },
    { label: "Сообщений за 7 дней", value: totalMessages7d.toLocaleString("ru-RU") },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-950">
      <main className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map((s) => (
            <div
              key={s.label}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm px-5 py-4"
            >
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{s.label}</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Messages per day chart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm px-5 py-5">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Сообщения за последние 7 дней</p>
          <div className="flex items-end gap-2 h-32">
            {days.map(([day, val]) => {
              const height = maxDayCount > 0 ? Math.max((val / maxDayCount) * 100, val > 0 ? 4 : 0) : 0;
              const label = new Date(day + "T00:00:00").toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "short",
              });
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    className="w-full rounded-t-sm bg-blue-500 transition-all group-hover:bg-blue-600"
                    style={{ height: `${height}%`, minHeight: val > 0 ? 3 : 0 }}
                  />
                  {val > 0 && (
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                      {label}: {val}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-gray-400 dark:text-gray-500">
            <span>
              {days[0]?.[0]
                ? new Date(days[0][0] + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
                : ""}
            </span>
            <span>
              {days[days.length - 1]?.[0]
                ? new Date(days[days.length - 1][0] + "T00:00:00").toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "short",
                  })
                : ""}
            </span>
          </div>
        </div>

        {/* Top recipes */}
        {topRecipes.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Топ-5 рецептов по рейтингу</p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {topRecipes.map(([id, r], idx) => (
                <div key={id} className="px-5 py-3 flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 w-4 shrink-0">
                    {idx + 1}
                  </span>
                  <span className="flex-1 text-sm text-gray-900 dark:text-gray-100 truncate">{r.title}</span>
                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    {r.up > 0 && (
                      <span className="text-green-600 dark:text-green-400 font-medium">👍 {r.up}</span>
                    )}
                    {r.down > 0 && (
                      <span className="text-red-500 dark:text-red-400 font-medium">👎 {r.down}</span>
                    )}
                    <span className={`font-semibold tabular-nums ${r.net >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {r.net >= 0 ? "+" : ""}{r.net}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manager stats */}
        {managerStats.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Активность менеджеров за 30 дней</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2.5 font-medium">Менеджер</th>
                  <th className="text-right px-5 py-2.5 font-medium">Сообщений</th>
                  <th className="text-right px-5 py-2.5 font-medium">Чатов</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {managerStats.map((m) => (
                  <tr key={m.name}>
                    <td className="px-5 py-3 text-gray-900 dark:text-gray-100 font-medium">{m.name}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{m.messages.toLocaleString("ru-RU")}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{m.chats}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalRecipes === 0 && totalClients === 0 && (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500">Данных пока нет</div>
        )}
      </main>
    </div>
  );
}
