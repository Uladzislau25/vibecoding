"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/shared/api/supabase-browser";
import { formatRecipe, titleFromText, type RecipeRow } from "@/features/chat/lib/recipe";
import FavoritesSheet from "./FavoritesSheet";
import PreferencesSheet from "./PreferencesSheet";

export type DishSuggestion = { title: string; description: string };

export type ChatMessage = {
  role: "user" | "bot";
  text: string;
  recipeId?: number | null;
  title?: string | null;
  clarify?: string[];
  suggestions?: DishSuggestion[];
  products?: string;
};

const RECIPE_COLS = "id, title, ingredients, instructions, calories, protein, fat, carbs, cook_time, servings";

const INITIAL_CHIPS = ["🥗 Что приготовить на ужин?", "📅 План на неделю"];

const GREETING: ChatMessage = {
  role: "bot",
  text: "Привет! Я Шеф 👨‍🍳 Напишите, что хотите приготовить, или назовите блюдо — пришлю рецепт с ингредиентами, шагами и КБЖУ.",
};

export default function ChatClient({ initialMessages }: { initialMessages: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages.length > 0 ? initialMessages : [GREETING],
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rated, setRated] = useState<Record<number, number>>({});
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [sheet, setSheet] = useState<"none" | "favorites" | "preferences">("none");
  const [ingredientsMode, setIngredientsMode] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function pushBot(text: string, recipeId: number | null = null, title: string | null = null) {
    setMessages((prev) => [...prev, { role: "bot", text, recipeId, title }]);
  }

  async function send(text: string, opts?: { mode?: "suggest" }) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const suggestMode = opts?.mode === "suggest";
    setInput("");
    setError(null);
    setIngredientsMode(false);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setSending(true);

    try {
      const supabase = getSupabaseBrowser();
      const { data, error: fnError } = await supabase.functions.invoke("web-chat", {
        body: suggestMode ? { text: trimmed, mode: "suggest" } : { text: trimmed },
      });
      if (fnError) throw fnError;

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: data.text as string,
          recipeId: data.recipeId as number | null,
          clarify: (data.clarifyOptions as string[]) ?? [],
          suggestions: (data.suggestions as DishSuggestion[]) ?? [],
          products: (data.products as string) ?? null,
        },
      ]);
    } catch {
      setError("Не удалось получить ответ. Попробуйте ещё раз.");
    } finally {
      setSending(false);
    }
  }

  // Entry point for "what can I cook from these products?": prime the input so
  // the next message is sent in suggest mode instead of straight recipe generation.
  function startIngredientsMode() {
    if (sending) return;
    setIngredientsMode(true);
    pushBot("Перечислите продукты, которые у вас есть (через запятую) — подскажу, что из них можно приготовить 🧺");
  }

  async function randomRecipe() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const { data } = await getSupabaseBrowser()
        .from("recipes")
        .select(RECIPE_COLS)
        .order("id", { ascending: false })
        .limit(100);
      const rows = (data ?? []) as RecipeRow[];
      if (rows.length === 0) {
        pushBot("Рецептов пока нет в базе. Напишите, что приготовить!");
        return;
      }
      const r = rows[Math.floor(Math.random() * rows.length)];
      pushBot(formatRecipe(r), r.id, r.title);
    } finally {
      setSending(false);
    }
  }

  async function shopping(recipeId: number) {
    const { data } = await getSupabaseBrowser()
      .from("recipes")
      .select("title, ingredients")
      .eq("id", recipeId)
      .maybeSingle();
    if (!data) return;
    pushBot(`🛒 Список покупок для «${data.title}»:\n\n${data.ingredients}`);
  }

  async function rate(recipeId: number, rating: number) {
    setRated((prev) => ({ ...prev, [recipeId]: rating }));
    await getSupabaseBrowser().rpc("rate_recipe", { p_recipe_id: recipeId, p_rating: rating });
  }

  async function saveFavorite(recipeId: number, title: string) {
    setSaved((prev) => new Set(prev).add(recipeId));
    await getSupabaseBrowser().rpc("save_favorite", { p_recipe_id: recipeId, p_title: title });
  }

  function submitInput() {
    send(input, ingredientsMode ? { mode: "suggest" } : undefined);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitInput();
  }

  const showInitialChips = messages.length <= 1 && !sending;

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map((m, i) => {
          const recipeId = m.recipeId ?? null;
          return (
            <div key={i} className={m.role === "user" ? "self-end max-w-[85%]" : "self-start max-w-[85%]"}>
              <div
                className={
                  m.role === "user"
                    ? "rounded-2xl rounded-br-md bg-orange-600 text-white px-4 py-2.5 text-sm whitespace-pre-wrap"
                    : "rounded-2xl rounded-bl-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-2.5 text-sm whitespace-pre-wrap"
                }
              >
                {m.text}
              </div>

              {m.role === "bot" && m.clarify && m.clarify.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {m.clarify.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => send(opt)}
                      className="text-left text-sm px-3 py-2 rounded-xl border border-orange-200 dark:border-orange-900 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {m.role === "bot" && m.suggestions && m.suggestions.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  {m.suggestions.map((dish) => (
                    <div
                      key={dish.title}
                      className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-3"
                    >
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{dish.title}</div>
                      {dish.description && (
                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{dish.description}</div>
                      )}
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() =>
                          send(
                            `Приготовь «${dish.title}» строго из этих продуктов: ${m.products ?? ""}`.trim(),
                          )}
                        className="mt-2 text-sm px-3 py-1.5 rounded-xl bg-orange-600 text-white font-medium hover:bg-orange-700 active:bg-orange-800 disabled:opacity-50 transition-colors"
                      >
                        Рецепт →
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {m.role === "bot" && recipeId !== null && (
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => rate(recipeId, 1)}
                    className={`px-2.5 py-1 rounded-lg border text-sm transition-colors ${rated[recipeId] === 1 ? "border-green-400 bg-green-50 dark:bg-green-950/40" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                  >
                    👍
                  </button>
                  <button
                    type="button"
                    onClick={() => rate(recipeId, -1)}
                    className={`px-2.5 py-1 rounded-lg border text-sm transition-colors ${rated[recipeId] === -1 ? "border-red-400 bg-red-50 dark:bg-red-950/40" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                  >
                    👎
                  </button>
                  <button
                    type="button"
                    disabled={saved.has(recipeId)}
                    onClick={() => saveFavorite(recipeId, m.title ?? titleFromText(m.text))}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
                  >
                    {saved.has(recipeId) ? "⭐ Сохранено" : "⭐ Сохранить"}
                  </button>
                  <button
                    type="button"
                    onClick={() => shopping(recipeId)}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    🛒
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {sending && (
          <div className="self-start max-w-[85%]">
            <div className="rounded-2xl rounded-bl-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-4 py-2.5 text-sm">
              Шеф печатает…
            </div>
          </div>
        )}

        {showInitialChips && (
          <div className="flex flex-wrap gap-2 mt-1">
            {INITIAL_CHIPS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="text-sm px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {error && <div className="shrink-0 px-4 pb-1 text-center text-xs text-red-600">{error}</div>}

      <div className="shrink-0 flex gap-2 px-3 py-2 border-t border-gray-200 dark:border-gray-800 overflow-x-auto bg-white dark:bg-gray-900">
        <button type="button" onClick={randomRecipe} disabled={sending} className="shrink-0 text-sm px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
          🎲 Случайный
        </button>
        <button type="button" onClick={startIngredientsMode} disabled={sending} className={`shrink-0 text-sm px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${ingredientsMode ? "border-orange-400 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300" : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
          🧺 Что из продуктов?
        </button>
        <button type="button" onClick={() => setSheet("favorites")} className="shrink-0 text-sm px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
          ⭐ Избранное
        </button>
        <button type="button" onClick={() => setSheet("preferences")} className="shrink-0 text-sm px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
          ⚙️ Предпочтения
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="shrink-0 flex items-end gap-2 border-t border-gray-200 dark:border-gray-800 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] bg-white dark:bg-gray-900"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitInput();
            }
          }}
          rows={1}
          placeholder={ingredientsMode ? "Например: курица, рис, морковь, лук…" : "Что готовим?"}
          className="flex-1 resize-none rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors max-h-32"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="shrink-0 rounded-2xl bg-orange-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-orange-700 active:bg-orange-800 disabled:opacity-40 transition-colors"
        >
          ➤
        </button>
      </form>

      {sheet === "favorites" && (
        <FavoritesSheet
          onClose={() => setSheet("none")}
          onPick={(title) => {
            setSheet("none");
            send(title);
          }}
        />
      )}
      {sheet === "preferences" && <PreferencesSheet onClose={() => setSheet("none")} />}
    </>
  );
}
