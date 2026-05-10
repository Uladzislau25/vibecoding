"use client";

import { useState, useTransition } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { addNote } from "@/app/actions";

const QUICK_REPLIES = [
  "Добрый день! Чем могу помочь?",
  "Одну минуту, смотрю ваш вопрос.",
  "Понял вас, сейчас помогу.",
  "Передаю информацию специалисту.",
  "Есть ли ещё вопросы?",
];

type Props = {
  clientId: number;
  managerId: number;
};

export default function ReplyForm({ clientId, managerId }: Props) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showTemplates, setShowTemplates] = useState(false);

  function send() {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setError(null);

    if (mode === "note") {
      start(async () => {
        try {
          await addNote(clientId, managerId, trimmed);
          setText("");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Ошибка");
        }
      });
      return;
    }

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

  const isNote = mode === "note";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm p-2 flex flex-col gap-1"
    >
      <div className="px-1 pt-1 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setMode("reply")}
              className={`px-3 py-1 transition-colors ${!isNote ? "bg-blue-500 text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
            >
              Ответить
            </button>
            <button
              type="button"
              onClick={() => setMode("note")}
              className={`px-3 py-1 transition-colors border-l border-gray-200 dark:border-gray-700 ${isNote ? "bg-amber-400 text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
            >
              📝 Заметка
            </button>
          </div>
          {!isNote && (
            <button
              type="button"
              onClick={() => setShowTemplates((v) => !v)}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {showTemplates ? "Шаблоны ↑" : "Шаблоны ↓"}
            </button>
          )}
        </div>

        {!isNote && showTemplates && (
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REPLIES.map((tpl) => (
              <button
                key={tpl}
                type="button"
                onClick={() => setText(tpl)}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {tpl}
              </button>
            ))}
          </div>
        )}

        {isNote && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            Заметка видна только в админ-панели, клиенту не отправляется
          </p>
        )}
      </div>

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
          placeholder={isNote ? "Внутренняя заметка…" : "Ответить как менеджер…"}
          rows={1}
          className={`flex-1 resize-none border rounded-xl px-3 py-2 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 max-h-40 transition-colors ${
            isNote
              ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 focus:ring-amber-400/20 focus:border-amber-400 dark:focus:border-amber-600"
              : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500"
          }`}
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className={`px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
            isNote
              ? "bg-amber-400 hover:bg-amber-500 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          {pending ? "…" : isNote ? "Сохранить" : "Отправить"}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-500 px-2 pb-1">{error}</p>
      )}
    </form>
  );
}
