"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/shared/api/supabase-browser";
import Sheet from "./Sheet";

// Quick toggles compose into the free-text dietary_notes that the generator
// already injects into every prompt; the structured form is persisted in
// client_preferences.prefs so the sheet can round-trip on reload.
const TOGGLES: { key: string; label: string; note: string }[] = [
  { key: "vegetarian", label: "🥦 Вегетарианец", note: "вегетарианские блюда" },
  { key: "vegan", label: "🌱 Веган", note: "веганские блюда, без продуктов животного происхождения" },
  { key: "noLactose", label: "🥛 Без лактозы", note: "без лактозы" },
  { key: "noGluten", label: "🌾 Без глютена", note: "без глютена" },
  { key: "noNuts", label: "🥜 Без орехов", note: "без орехов" },
  { key: "notSpicy", label: "🌶️ Не острое", note: "не острое" },
  { key: "halal", label: "☪️ Халяль", note: "халяль, без свинины и алкоголя" },
];

type Prefs = { toggles: Record<string, boolean>; calories: string; notes: string };

function composeNotes(p: Prefs): string {
  const parts: string[] = [];
  for (const t of TOGGLES) if (p.toggles[t.key]) parts.push(t.note);
  const cals = p.calories.trim();
  if (cals) parts.push(`цель по калорийности около ${cals} ккал в день`);
  if (p.notes.trim()) parts.push(p.notes.trim());
  return parts.join("; ");
}

export default function PreferencesSheet({ onClose }: { onClose: () => void }) {
  const [prefs, setPrefs] = useState<Prefs>({ toggles: {}, calories: "", notes: "" });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    getSupabaseBrowser()
      .from("client_preferences")
      .select("prefs")
      .maybeSingle()
      .then(({ data }) => {
        const stored = (data?.prefs ?? {}) as Partial<Prefs>;
        setPrefs({
          toggles: stored.toggles ?? {},
          calories: stored.calories ?? "",
          notes: stored.notes ?? "",
        });
        setLoaded(true);
      });
  }, []);

  function update(patch: Partial<Prefs>) {
    setPrefs((prev) => ({ ...prev, ...patch }));
    setSavedAt(null);
  }

  async function save() {
    setSaving(true);
    try {
      const { error } = await getSupabaseBrowser().rpc("set_preferences_v2", {
        p_prefs: prefs,
        p_notes: composeNotes(prefs),
      });
      if (error) throw error;
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet title="⚙️ Предпочтения" onClose={onClose}>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        Учитываются в каждом рецепте и плане на неделю.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {TOGGLES.map((t) => {
          const on = !!prefs.toggles[t.key];
          return (
            <button
              key={t.key}
              type="button"
              disabled={!loaded}
              onClick={() => update({ toggles: { ...prefs.toggles, [t.key]: !on } })}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                on
                  ? "border-orange-400 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <label className="mt-4 block text-xs text-gray-500 dark:text-gray-400">
        🔥 Цель по калориям в день
      </label>
      <input
        value={prefs.calories}
        onChange={(e) => update({ calories: e.target.value.replace(/\D/g, "") })}
        disabled={!loaded}
        inputMode="numeric"
        placeholder="например, 2000"
        className="mt-1 w-40 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none"
      />

      <label className="mt-4 block text-xs text-gray-500 dark:text-gray-400">
        📝 Другое (аллергии, вкусы)
      </label>
      <textarea
        value={prefs.notes}
        onChange={(e) => update({ notes: e.target.value })}
        disabled={!loaded}
        rows={3}
        placeholder="например: не люблю кинзу, аллергия на морепродукты"
        className="mt-1 w-full resize-none rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !loaded}
          className="rounded-xl bg-orange-600 text-white px-4 py-2 text-sm font-semibold hover:bg-orange-700 active:bg-orange-800 disabled:opacity-50"
        >
          {saving ? "Сохраняю…" : "Сохранить"}
        </button>
        {savedAt && <span className="text-xs text-green-600">Сохранено</span>}
      </div>
    </Sheet>
  );
}
