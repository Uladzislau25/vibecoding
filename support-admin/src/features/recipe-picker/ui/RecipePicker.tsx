"use client";

import { useState, useTransition, useCallback } from "react";
import { getRecipesForPicker } from "@/features/recipe-management/api/actions";
import { getSupabaseBrowser } from "@/shared/api/supabase-browser";

type Recipe = { id: number; title: string; category: string | null };

export default function RecipePicker({ clientId, managerId }: { clientId: number; managerId: number }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sending, startSend] = useTransition();
  const [sentId, setSentId] = useState<number | null>(null);

  const load = useCallback(async (q: string) => {
    const data = await getRecipesForPicker(q);
    setRecipes(data);
    setLoaded(true);
  }, []);

  function handleOpen() {
    setOpen(true);
    setSentId(null);
    if (!loaded) load("");
  }

  function handleSend(recipe: Recipe) {
    startSend(async () => {
      const supabase = getSupabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await supabase.functions.invoke("admin-reply", {
        body: { chatId: clientId, managerId, recipeId: recipe.id },
      });

      if (!res.error) {
        setSentId(recipe.id);
        setTimeout(() => { setOpen(false); setSearch(""); setLoaded(false); setSentId(null); }, 800);
      }
    });
  }

  return (
    <>
      <button type="button" onClick={handleOpen} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        📖 Рецепт из базы
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col max-h-[70vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Выбрать рецепт</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">✕</button>
            </div>
            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
              <input autoFocus type="search" placeholder="Поиск по названию..." value={search} onChange={(e) => { setSearch(e.target.value); load(e.target.value); }}
                className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {!loaded && <p className="text-center text-sm text-gray-400 py-8">Загрузка...</p>}
              {loaded && recipes.length === 0 && <p className="text-center text-sm text-gray-400 py-8">Ничего не найдено</p>}
              {recipes.map((r) => (
                <button key={r.id} type="button" disabled={sending} onClick={() => handleSend(r)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0 disabled:opacity-50">
                  <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{r.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">{r.category}</span>}
                    {sentId === r.id ? <span className="text-xs text-green-600">Отправлено</span> : <span className="text-xs text-blue-500">Отправить</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
