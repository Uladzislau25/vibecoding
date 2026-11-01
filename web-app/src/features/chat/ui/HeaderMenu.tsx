"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/shared/api/supabase-browser";
import { logout } from "@/features/auth/api/actions";
import ThemeToggle from "@/features/theme/ThemeToggle";
import PushToggle from "@/features/pwa/PushToggle";

export default function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function clearHistory() {
    if (clearing) return;
    if (!confirm("Очистить всю переписку?")) return;
    setClearing(true);
    try {
      const { error } = await getSupabaseBrowser().rpc("clear_my_web_history", {});
      if (error) throw error;
      // Reload so the chat re-renders from the (now empty) server history.
      window.location.reload();
    } catch {
      setClearing(false);
      alert("Не удалось очистить историю.");
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Меню"
        aria-expanded={open}
        className="text-lg leading-none px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        ☰
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-2 z-50 flex flex-col gap-0.5">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm text-gray-700 dark:text-gray-200">Тема</span>
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm text-gray-700 dark:text-gray-200">Уведомления</span>
            <PushToggle />
          </div>

          <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

          <button
            type="button"
            onClick={clearHistory}
            disabled={clearing}
            className="text-left text-sm px-2 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            {clearing ? "Очищаю…" : "🗑 Очистить историю"}
          </button>

          <form action={logout}>
            <button
              type="submit"
              className="w-full text-left text-sm px-2 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              Выйти
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
