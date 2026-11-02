"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/shared/api/supabase-browser";
import Sheet from "./Sheet";

type Item = { id: number; item: string; checked: boolean };

export default function ShoppingListSheet({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null);

  async function load() {
    const { data } = await getSupabaseBrowser()
      .from("shopping_list_items")
      .select("id, item, checked")
      .order("checked", { ascending: true })
      .order("created_at", { ascending: true });
    setItems((data ?? []) as Item[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(it: Item) {
    const next = !it.checked;
    setItems((prev) => (prev ?? []).map((x) => (x.id === it.id ? { ...x, checked: next } : x)));
    await getSupabaseBrowser().rpc("toggle_shopping_item", { p_id: it.id, p_checked: next });
  }

  async function clear(onlyChecked: boolean) {
    await getSupabaseBrowser().rpc("clear_shopping_list", { p_only_checked: onlyChecked });
    load();
  }

  return (
    <Sheet title="🛒 Список покупок" onClose={onClose}>
      {items === null ? (
        <p className="text-sm text-gray-400 py-4 text-center">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">
          Список пуст. Добавляйте ингредиенты из рецептов кнопкой 🛒.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => toggle(it)}
                  className="flex items-start gap-2 text-left w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="mt-0.5 shrink-0">{it.checked ? "☑️" : "⬜"}</span>
                  <span className={`text-sm ${it.checked ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-100"}`}>
                    {it.item}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => clear(true)}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Убрать отмеченные
            </button>
            <button
              type="button"
              onClick={() => clear(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              Очистить всё
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
