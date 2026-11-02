"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/shared/api/supabase-browser";
import Sheet from "./Sheet";

type Fav = { recipe_id: number; title: string };

export default function FavoritesSheet({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (recipeId: number) => void;
}) {
  const [items, setItems] = useState<Fav[] | null>(null);

  useEffect(() => {
    getSupabaseBrowser()
      .from("client_favorite_recipes")
      .select("recipe_id, title")
      .order("saved_at", { ascending: false })
      .then(({ data }) => setItems((data ?? []) as Fav[]));
  }, []);

  async function remove(recipeId: number) {
    await getSupabaseBrowser().from("client_favorite_recipes").delete().eq("recipe_id", recipeId);
    setItems((prev) => (prev ?? []).filter((f) => f.recipe_id !== recipeId));
  }

  return (
    <Sheet title="⭐ Избранное" onClose={onClose}>
      {items === null ? (
        <p className="text-sm text-gray-400 py-4 text-center">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">
          Пока пусто. Сохраняйте рецепты кнопкой ⭐.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((f) => (
            <li key={f.recipe_id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPick(f.recipe_id)}
                className="flex-1 text-left text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {f.title}
              </button>
              <button
                type="button"
                onClick={() => remove(f.recipe_id)}
                aria-label="Удалить"
                className="shrink-0 text-gray-400 hover:text-red-500 px-2 py-2"
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
