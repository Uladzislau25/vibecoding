"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createRecipe,
  deleteRecipe,
  updateRecipe,
  type RecipeInput,
} from "./actions";

type Recipe = {
  id: number;
  title: string;
  description: string | null;
  ingredients: string;
  instructions: string;
  created_at: string;
};

const EMPTY: RecipeInput = {
  title: "",
  description: "",
  ingredients: "",
  instructions: "",
};

type FormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; id: number };

export default function RecipesList({ recipes }: { recipes: Recipe[] }) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [draft, setDraft] = useState<RecipeInput>(EMPTY);
  const [submitting, startSubmit] = useTransition();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingPending, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => {
      return (
        r.title.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        r.ingredients.toLowerCase().includes(q) ||
        r.instructions.toLowerCase().includes(q)
      );
    });
  }, [recipes, search]);

  function openCreate() {
    setDraft(EMPTY);
    setError(null);
    setForm({ mode: "create" });
  }

  function openEdit(r: Recipe) {
    setDraft({
      title: r.title,
      description: r.description ?? "",
      ingredients: r.ingredients,
      instructions: r.instructions,
    });
    setError(null);
    setForm({ mode: "edit", id: r.id });
  }

  function closeForm() {
    setForm({ mode: "closed" });
    setError(null);
  }

  function submit() {
    if (!draft.title.trim() || !draft.ingredients.trim() || !draft.instructions.trim()) {
      setError("Заполните название, ингредиенты и инструкции");
      return;
    }
    setError(null);
    startSubmit(async () => {
      try {
        if (form.mode === "edit") {
          await updateRecipe(form.id, draft);
        } else if (form.mode === "create") {
          await createRecipe(draft);
        }
        setForm({ mode: "closed" });
        setDraft(EMPTY);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка сохранения");
      }
    });
  }

  function confirmDelete(id: number) {
    if (!confirm("Удалить рецепт?")) return;
    setDeletingId(id);
    startDelete(async () => {
      try {
        await deleteRecipe(id);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Ошибка удаления");
      } finally {
        setDeletingId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию, ингредиентам, инструкциям…"
          className="flex-1 text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
        />
        <button
          type="button"
          onClick={openCreate}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Добавить
        </button>
      </div>

      <div className="text-xs text-gray-500">
        Всего:{" "}
        <span className="font-medium text-gray-700">{filtered.length}</span>
        {filtered.length !== recipes.length && (
          <span className="text-gray-400"> / {recipes.length}</span>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Название</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">
                Ингредиенты
              </th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">
                Создан
              </th>
              <th className="px-4 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-t border-gray-100 hover:bg-gray-50/50"
              >
                <td className="px-4 py-3 align-top">
                  <div className="font-medium text-gray-900 line-clamp-1">
                    {r.title}
                  </div>
                  {r.description && (
                    <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                      {r.description}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 align-top hidden md:table-cell">
                  <div className="text-xs text-gray-600 line-clamp-3 max-w-xs">
                    {r.ingredients}
                  </div>
                </td>
                <td className="px-4 py-3 align-top hidden lg:table-cell text-xs text-gray-400 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Изм.
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmDelete(r.id)}
                      disabled={deletingPending && deletingId === r.id}
                      className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      Удал.
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center text-gray-400 text-sm"
                >
                  {recipes.length === 0
                    ? "Рецептов пока нет"
                    : "Ничего не найдено"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {form.mode !== "closed" && (
        <div
          className="fixed inset-0 z-20 bg-black/30 flex items-start justify-center p-4 overflow-y-auto"
          onClick={closeForm}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mt-10 p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {form.mode === "edit" ? "Редактировать рецепт" : "Новый рецепт"}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-600">
                Название *
              </span>
              <input
                type="text"
                value={draft.title}
                onChange={(e) =>
                  setDraft({ ...draft, title: e.target.value })
                }
                maxLength={256}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-600">Описание</span>
              <textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                rows={3}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors resize-y"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-600">
                Ингредиенты *
              </span>
              <textarea
                value={draft.ingredients}
                onChange={(e) =>
                  setDraft({ ...draft, ingredients: e.target.value })
                }
                rows={5}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors resize-y"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-600">
                Инструкции *
              </span>
              <textarea
                value={draft.instructions}
                onChange={(e) =>
                  setDraft({ ...draft, instructions: e.target.value })
                }
                rows={6}
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors resize-y"
              />
            </label>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                className="text-sm font-medium px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting
                  ? "Сохранение…"
                  : form.mode === "edit"
                    ? "Сохранить"
                    : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
