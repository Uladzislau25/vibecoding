"use client";

import { useState, useTransition } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Props = {
  clientId: number;
  managerId: number;
};

export default function ReplyForm({ clientId, managerId }: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send() {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setError(null);
    start(async () => {
      const supabase = getSupabaseBrowser();
      const { error: invokeError } = await supabase.functions.invoke(
        "admin-reply",
        { body: { chatId: clientId, message: trimmed, managerId } },
      );
      if (invokeError) {
        setError(invokeError.message);
        return;
      }
      setText("");
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm p-2 flex flex-col gap-1"
    >
      <div className="flex gap-2 items-end">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ответить как менеджер…"
          rows={1}
          className="flex-1 resize-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 max-h-40"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? "…" : "Отправить"}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-500 px-2 pb-1">{error}</p>
      )}
    </form>
  );
}
