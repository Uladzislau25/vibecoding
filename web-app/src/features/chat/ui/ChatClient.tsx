"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/shared/api/supabase-browser";

export type ChatMessage = {
  role: "user" | "bot";
  text: string;
  recipeId?: number | null;
  clarify?: string[];
};

const QUICK_ACTIONS = [
  "🎲 Случайный рецепт",
  "🥗 Что приготовить на ужин?",
  "📅 План на неделю",
];

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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setSending(true);

    try {
      const supabase = getSupabaseBrowser();
      const { data, error: fnError } = await supabase.functions.invoke("web-chat", {
        body: { text: trimmed },
      });
      if (fnError) throw fnError;

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: data.text as string,
          recipeId: data.recipeId as number | null,
          clarify: (data.clarifyOptions as string[]) ?? [],
        },
      ]);
    } catch {
      setError("Не удалось получить ответ. Попробуйте ещё раз.");
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  const showQuickActions = messages.length <= 1 && !sending;

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map((m, i) => (
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
          </div>
        ))}

        {sending && (
          <div className="self-start max-w-[85%]">
            <div className="rounded-2xl rounded-bl-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-4 py-2.5 text-sm">
              Шеф печатает…
            </div>
          </div>
        )}

        {showQuickActions && (
          <div className="flex flex-wrap gap-2 mt-1">
            {QUICK_ACTIONS.map((q) => (
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

      {error && (
        <div className="shrink-0 px-4 pb-2 text-center text-xs text-red-600">{error}</div>
      )}

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
              send(input);
            }
          }}
          rows={1}
          placeholder="Что готовим?"
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
    </>
  );
}
