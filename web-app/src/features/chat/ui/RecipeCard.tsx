"use client";

import { useMemo, useState } from "react";
import { parseRecipe, scaleRecipeText } from "@/features/chat/lib/recipe";

// Renders a bot recipe message as a structured card: scalable ingredient list
// with tick-off checkboxes, numbered steps, cook meta and nutrition. Falls back
// to plain text if the message isn't a recipe layout.
export default function RecipeCard({
  text,
  onAddToList,
}: {
  text: string;
  onAddToList?: (ingredients: string[]) => void;
}) {
  const [scale, setScale] = useState(1);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [added, setAdded] = useState(false);

  const parsed = useMemo(() => parseRecipe(scaleRecipeText(text, scale)), [text, scale]);

  if (!parsed) return <span className="whitespace-pre-wrap">{text}</span>;

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const scaleBtn = (f: number, label: string) => (
    <button
      type="button"
      onClick={() => setScale(f)}
      className={`px-2 py-0.5 rounded-md text-xs border transition-colors ${
        scale === f
          ? "border-orange-400 bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300"
          : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="font-semibold text-gray-900 dark:text-gray-100">🍽️ {parsed.title}</div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">🛒 Ингредиенты</span>
          <div className="flex items-center gap-1">
            {scaleBtn(0.5, "÷2")}
            {scaleBtn(1, "1×")}
            {scaleBtn(2, "×2")}
          </div>
        </div>
        <ul className="flex flex-col gap-1">
          {parsed.ingredients.map((ing, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                className="flex items-start gap-2 text-left w-full"
              >
                <span className="mt-0.5 shrink-0">{checked.has(i) ? "☑️" : "⬜"}</span>
                <span className={checked.has(i) ? "line-through text-gray-400" : ""}>{ing}</span>
              </button>
            </li>
          ))}
        </ul>
        {onAddToList && parsed.ingredients.length > 0 && (
          <button
            type="button"
            disabled={added}
            onClick={() => {
              onAddToList(parsed.ingredients);
              setAdded(true);
            }}
            className="mt-2 text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
          >
            {added ? "🛒 Добавлено в список" : "🛒 В список покупок"}
          </button>
        )}
      </div>

      <div>
        <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">👨‍🍳 Приготовление</div>
        <ol className="flex flex-col gap-1.5">
          {parsed.steps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 font-semibold text-orange-600 dark:text-orange-400">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {parsed.meta.length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">{parsed.meta.join(" · ")}</div>
      )}

      {parsed.nutrition.length > 0 && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
            📊 На 1 порцию
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-300">{parsed.nutrition.join(" · ")}</div>
        </div>
      )}
    </div>
  );
}
