"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/shared/api/supabase-browser";
import Sheet from "./Sheet";

export default function PreferencesSheet({ onClose }: { onClose: () => void }) {
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    getSupabaseBrowser()
      .from("client_preferences")
      .select("dietary_notes")
      .maybeSingle()
      .then(({ data }) => {
        setNotes(data?.dietary_notes ?? "");
        setLoaded(true);
      });
  }, []);

  async function save() {
    setSaving(true);
    try {
      const { error } = await getSupabaseBrowser().rpc("set_preferences", { p_notes: notes });
      if (error) throw error;
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet title="⚙️ Предпочтения" onClose={onClose}>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        Ограничения, аллергии, вкусы — учитываются в каждом рецепте. Например: вегетарианец, без
        лактозы, не люблю острое.
      </p>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSavedAt(null);
        }}
        disabled={!loaded}
        rows={4}
        placeholder="Ваши предпочтения…"
        className="w-full resize-none rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
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
