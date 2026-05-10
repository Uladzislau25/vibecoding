"use client";

import { useMemo, useState, useTransition } from "react";
import { createRecipe, deleteRecipe, updateRecipe, type RecipeInput } from "@/features/recipe-management/api/actions";

const CATEGORIES: { label: string; keywords: string[] }[] = [
  { label: "Супы", keywords: ["суп", "борщ", "щи", "бульон", "похлёбка", "уха", "солянка", "рассольник"] },
  { label: "Выпечка", keywords: ["пирог", "хлеб", "булочка", "торт", "печенье", "кекс", "пицца", "блины", "оладьи", "пирожок", "круассан"] },
  { label: "Салаты", keywords: ["салат", "винегрет"] },
  { label: "Мясные", keywords: ["мясо", "говядина", "свинина", "курица", "котлета", "стейк", "отбивная", "шашлык", "фарш", "утка", "индейка", "ребра"] },
  { label: "Рыбные", keywords: ["рыба", "лосось", "треска", "тунец", "семга", "карп", "форель", "скумбрия", "креветки", "морепродукты"] },
  { label: "Десерты", keywords: ["десерт", "мороженое", "желе", "пудинг", "шоколад", "конфета", "торт", "пирожное", "сырник", "чизкейк"] },
  { label: "Напитки", keywords: ["напиток", "сок", "коктейль", "смузи", "компот", "морс", "лимонад"] },
  { label: "Завтраки", keywords: ["каша", "омлет", "яичница", "яйца", "завтрак", "мюсли", "гранола"] },
  { label: "Закуски", keywords: ["закуска", "бутерброд", "канапе", "намазка", "паштет"] },
];

function getCategory(recipe: { title: string; description: string | null; ingredients: string; category: string | null }): string {
  if (recipe.category) return recipe.category;
  const text = `${recipe.title} ${recipe.description ?? ""} ${recipe.ingredients}`.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((kw) => text.includes(kw))) return cat.label;
  }
  return "Другое";
}

type Recipe = { id: number; title: string; description: string | null; ingredients: string; instructions: string; category: string | null; created_at: string };
type RatingsMap = Record<number, { up: number; down: number }>;
type FormState = { mode: "closed" } | { mode: "view"; recipe: Recipe } | { mode: "create" } | { mode: "edit"; id: number };

const EMPTY: RecipeInput = { title: "", description: "", ingredients: "", instructions: "" };

export default function RecipesList({ recipes, ratingsMap = {}, canEdit }: { recipes: Recipe[]; ratingsMap?: RatingsMap; canEdit: boolean }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [draft, setDraft] = useState<RecipeInput>(EMPTY);
  const [submitting, startSubmit] = useTransition();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingPending, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const categorized = useMemo(() => recipes.map((r) => ({ ...r, category: getCategory(r) })), [recipes]);
  const usedCategories = useMemo(() => { const counts: Record<string, number> = {}; for (const r of categorized) counts[r.category] = (counts[r.category] ?? 0) + 1; return counts; }, [categorized]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categorized.filter((r) => {
      if (category && r.category !== category) return false;
      if (!q) return true;
      return r.title.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q) || r.ingredients.toLowerCase().includes(q) || r.instructions.toLowerCase().includes(q);
    });
  }, [categorized, search, category]);

  function closeForm() { setForm({ mode: "closed" }); setError(null); }
  function openEdit(r: Recipe) { setDraft({ title: r.title, description: r.description ?? "", ingredients: r.ingredients, instructions: r.instructions }); setError(null); setForm({ mode: "edit", id: r.id }); }

  function submit() {
    if (!draft.title.trim() || !draft.ingredients.trim() || !draft.instructions.trim()) { setError("Заполните название, ингредиенты и инструкции"); return; }
    setError(null);
    startSubmit(async () => {
      try {
        if (form.mode === "edit") await updateRecipe(form.id, draft);
        else if (form.mode === "create") await createRecipe(draft);
        setForm({ mode: "closed" }); setDraft(EMPTY);
      } catch (e) { setError(e instanceof Error ? e.message : "Ошибка сохранения"); }
    });
  }

  function confirmDelete(id: number) {
    if (!confirm("Удалить рецепт?")) return;
    setDeletingId(id);
    startDelete(async () => {
      try { await deleteRecipe(id); if (form.mode === "view" && form.recipe.id === id) closeForm(); }
      catch (e) { alert(e instanceof Error ? e.message : "Ошибка удаления"); }
      finally { setDeletingId(null); }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию, ингредиентам, инструкциям…" className="flex-1 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 transition-colors" />
        {canEdit && <button type="button" onClick={() => { setDraft(EMPTY); setError(null); setForm({ mode: "create" }); }} className="text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">Добавить</button>}
      </div>

      {Object.keys(usedCategories).length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setCategory(null)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${category === null ? "bg-gray-900 text-white" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>Все</button>
          {Object.entries(usedCategories).sort(([a], [b]) => a.localeCompare(b, "ru")).map(([cat, count]) => (
            <button key={cat} onClick={() => setCategory(cat === category ? null : cat)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${category === cat ? "bg-gray-900 text-white" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>{cat} <span className="opacity-60">{count}</span></button>
          ))}
        </div>
      )}

      <div className="text-xs text-gray-500 dark:text-gray-400">Всего: <span className="font-medium text-gray-700 dark:text-gray-300">{filtered.length}</span>{filtered.length !== recipes.length && <span className="text-gray-400 dark:text-gray-500"> / {recipes.length}</span>}</div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Название</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Ингредиенты</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Создан</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Рейтинг</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => setForm({ mode: "view", recipe: r })}>
                <td className="px-4 py-3 align-top"><div className="font-medium text-gray-900 dark:text-gray-100 line-clamp-1">{r.title}</div>{r.description && <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{r.description}</div>}</td>
                <td className="px-4 py-3 align-top hidden md:table-cell"><div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 max-w-xs">{r.ingredients}</div></td>
                <td className="px-4 py-3 align-top hidden lg:table-cell text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}</td>
                <td className="px-4 py-3 align-top hidden sm:table-cell">{(() => { const rating = ratingsMap[r.id]; if (!rating || (rating.up === 0 && rating.down === 0)) return <span className="text-xs text-gray-300 dark:text-gray-600">—</span>; return <div className="flex items-center gap-2 text-xs">{rating.up > 0 && <span className="text-green-600 dark:text-green-400 font-medium">👍 {rating.up}</span>}{rating.down > 0 && <span className="text-red-500 dark:text-red-400 font-medium">👎 {rating.down}</span>}</div>; })()}</td>
                <td className="px-4 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                  {canEdit && (
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="text-xs px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Изм.</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); confirmDelete(r.id); }} disabled={deletingPending && deletingId === r.id} className="text-xs px-2.5 py-1 rounded-md border border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50">Удал.</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500 text-sm">{recipes.length === 0 ? "Рецептов пока нет" : "Ничего не найдено"}</td></tr>}
          </tbody>
        </table>
      </div>

      {form.mode !== "closed" && (
        <div className="fixed inset-0 z-20 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={closeForm}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-2xl w-full mt-10 mb-10 p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            {form.mode === "view" && (
              <>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-snug">{form.recipe.title}</h2>
                  <button type="button" onClick={closeForm} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 text-xl leading-none px-2 shrink-0" aria-label="Закрыть">×</button>
                </div>
                {form.recipe.description && <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{form.recipe.description}</p>}
                <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Ингредиенты</p><p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line leading-relaxed bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">{form.recipe.ingredients}</p></div>
                <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Инструкции</p><p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line leading-relaxed bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">{form.recipe.instructions}</p></div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Добавлен: {new Date(form.recipe.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</p>
                {canEdit && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <button type="button" onClick={() => confirmDelete(form.recipe.id)} disabled={deletingPending} className="text-sm font-medium px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50">Удалить</button>
                    <button type="button" onClick={() => openEdit(form.recipe)} className="text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">Редактировать</button>
                  </div>
                )}
              </>
            )}
            {(form.mode === "create" || form.mode === "edit") && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{form.mode === "edit" ? "Редактировать рецепт" : "Новый рецепт"}</h2>
                  <button type="button" onClick={closeForm} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 text-xl leading-none px-2" aria-label="Закрыть">×</button>
                </div>
                {(["title", "description", "ingredients", "instructions"] as const).map((field) => (
                  <label key={field} className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{field === "title" ? "Название *" : field === "description" ? "Описание" : field === "ingredients" ? "Ингредиенты *" : "Инструкции *"}</span>
                    {field === "title"
                      ? <input type="text" value={draft[field]} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} maxLength={256} className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 transition-colors" />
                      : <textarea value={draft[field]} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} rows={field === "description" ? 3 : field === "ingredients" ? 5 : 6} className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 transition-colors resize-y" />
                    }
                  </label>
                ))}
                {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button type="button" onClick={closeForm} disabled={submitting} className="text-sm font-medium px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">Отмена</button>
                  <button type="button" onClick={submit} disabled={submitting} className="text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50">{submitting ? "Сохранение…" : form.mode === "edit" ? "Сохранить" : "Добавить"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
