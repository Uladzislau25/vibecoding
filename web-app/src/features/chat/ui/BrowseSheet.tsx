"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/shared/api/supabase-browser";
import Sheet from "./Sheet";

type Row = { id: number; title: string; category: string | null };

const CATEGORIES = [
  "Супы", "Салаты", "Основные блюда", "Десерты",
  "Завтраки", "Закуски", "Выпечка", "Напитки",
];

export default function BrowseSheet({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (recipeId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    const handle = setTimeout(async () => {
      let q = getSupabaseBrowser()
        .from("recipes")
        .select("id, title, category")
        .order("id", { ascending: false })
        .limit(60);
      if (category) q = q.eq("category", category);
      if (query.trim()) q = q.ilike("title", `%${query.trim()}%`);
      const { data } = await q;
      setRows((data ?? []) as Row[]);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, category]);

  return (
    <Sheet title="📖 Каталог рецептов" onClose={onClose}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск по названию…"
        className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={`text-xs px-2.5 py-1 rounded-full border ${category === null ? "border-orange-400 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"}`}
        >
          Все
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c === category ? null : c)}
            className={`text-xs px-2.5 py-1 rounded-full border ${category === c ? "border-orange-400 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {rows === null ? (
          <p className="text-sm text-gray-400 py-4 text-center">Загрузка…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Ничего не найдено.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onPick(r.id)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="text-sm text-gray-800 dark:text-gray-100">{r.title}</span>
                  {r.category && (
                    <span className="ml-2 text-xs text-gray-400">{r.category}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
