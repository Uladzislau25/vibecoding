"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export type SenderType = "client" | "manager" | "bot";

export type ChatMessage = {
  id: number;
  text: string;
  created_at: string;
  sender_type: SenderType;
  manager_id: number | null;
  total_tokens: number | null;
};

type Props = {
  clientId: number;
  clientName: string;
  managerNames: Record<number, string>;
  initialMessages: ChatMessage[];
};

export default function MessagesList({
  clientId,
  clientName,
  managerNames,
  initialMessages,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  useEffect(() => {
    setMessages(initialMessages);
  }, [clientId, initialMessages]);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`messages:client:${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const r = payload.new as {
            id: number;
            text: string;
            created_at: string;
            sender_type: SenderType;
            manager_id: number | null;
            total_tokens: number | null;
          };
          setMessages((prev) =>
            prev.some((m) => m.id === r.id)
              ? prev
              : [
                  {
                    id: r.id,
                    text: r.text,
                    created_at: r.created_at,
                    sender_type: r.sender_type ?? "client",
                    manager_id: r.manager_id,
                    total_tokens: r.total_tokens ?? null,
                  },
                  ...prev,
                ],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  if (messages.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400 dark:text-gray-500">
        Сообщений пока нет
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((msg) => {
        const time = new Date(msg.created_at).toLocaleString("ru-RU", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });

        const isClient = msg.sender_type === "client";
        const isBot = msg.sender_type === "bot";

        const sender = isClient
          ? clientName
          : isBot
            ? "Шеф-бот"
            : (msg.manager_id && managerNames[msg.manager_id]) || "Менеджер";

        const align = isClient ? "items-start" : "items-end";
        const bubble = isClient
          ? "bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80"
          : isBot
            ? "bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900"
            : "bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900";
        const senderColor = isClient
          ? "text-gray-900 dark:text-gray-100"
          : isBot
            ? "text-purple-700 dark:text-purple-400"
            : "text-blue-700 dark:text-blue-400";

        return (
          <div key={msg.id} className={`flex flex-col ${align}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${bubble}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className={`text-xs font-semibold ${senderColor}`}>
                  {sender}
                </span>
                <time className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {time}
                </time>
              </div>
              <p className="mt-1 text-[14px] leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {msg.text}
              </p>
              {isBot && msg.total_tokens != null && (
                <p className="mt-1.5 text-[10px] text-purple-500/80 dark:text-purple-400/80 tabular-nums">
                  {msg.total_tokens.toLocaleString("ru-RU")} токенов
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
