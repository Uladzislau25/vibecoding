"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export type ChatMessage = {
  id: number;
  text: string;
  created_at: string;
};

type Props = {
  clientId: number;
  displayName: string;
  initialMessages: ChatMessage[];
};

export default function MessagesList({
  clientId,
  displayName,
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
          const row = payload.new as ChatMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [...prev, {
                  id: row.id,
                  text: row.text,
                  created_at: row.created_at,
                }],
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
      <div className="text-center py-20 text-gray-400">
        Сообщений пока нет
      </div>
    );
  }

  return (
    <>
      {messages.map((msg) => {
        const time = new Date(msg.created_at).toLocaleString("ru-RU", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <div
            key={msg.id}
            className="bg-white rounded-2xl border border-gray-200/80 px-5 py-4 shadow-sm"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[15px] font-semibold text-gray-900">
                {displayName}
              </span>
              <time className="text-xs text-gray-400 whitespace-nowrap">
                {time}
              </time>
            </div>
            <p className="mt-1.5 text-[15px] leading-relaxed text-gray-700">
              {msg.text}
            </p>
          </div>
        );
      })}
    </>
  );
}
