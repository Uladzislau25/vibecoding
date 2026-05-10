"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/shared/api/supabase-browser";
import ChatCard from "./ChatCard";

type Manager = { id: number; name: string; position: string };

export type Chat = {
  id: number;
  display: string;
  lastMessageText: string | null;
  time: string;
  currentManagerId: number | null;
  status: string | null;
  escalationStatus: string | null;
  escalatedAt: string | null;
  unreadCount: number;
};

type Filter = "all" | "unassigned" | "open" | "closed" | "escalated";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "escalated", label: "Эскалация" },
  { value: "unassigned", label: "Без менеджера" },
  { value: "open", label: "Открытые" },
  { value: "closed", label: "Закрытые" },
];

export default function ChatList({ chats, managers }: { chats: Chat[]; managers: Manager[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel("home-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => router.refresh(), 800);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "clients" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          if (refreshTimer.current) clearTimeout(refreshTimer.current);
          refreshTimer.current = setTimeout(() => router.refresh(), 300);

          if (payload.new?.escalation_status === "escalated") {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification("ChefBot — нужен менеджер 👨‍🍳", {
                body: "Клиент ожидает помощи. Откройте вкладку Эскалация.",
                icon: "/favicon.ico",
              });
            }
            try {
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = 880;
              gain.gain.setValueAtTime(0.25, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 0.6);
            } catch {}
          }
        })
      .subscribe();

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  const filtered = chats.filter((c) => {
    if (search && !c.display.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "unassigned") return c.currentManagerId === null;
    if (filter === "open") return c.status !== "closed";
    if (filter === "closed") return c.status === "closed";
    if (filter === "escalated") return c.escalationStatus === "escalated" || c.escalationStatus === "manager_active";
    return true;
  });

  const escalatedCount = chats.filter((c) => c.escalationStatus === "escalated" || c.escalationStatus === "manager_active").length;
  const unassignedCount = chats.filter((c) => c.currentManagerId === null).length;

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-6 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
            <span>Чатов: <span className="font-medium text-gray-700 dark:text-gray-300">{chats.length}</span></span>
            {escalatedCount > 0 && <span className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-medium">Эскалация: {escalatedCount}</span>}
            {unassignedCount > 0 && <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-medium">Без менеджера: {unassignedCount}</span>}
          </div>
          <input type="search" placeholder="Поиск по имени..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-48 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${filter === f.value ? (f.value === "escalated" ? "bg-red-600 text-white" : "bg-gray-900 text-white") : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <main className="max-w-3xl mx-auto px-6 pb-8 flex flex-col gap-2">
        {filtered.map((chat) => (
          <ChatCard key={chat.id} clientId={chat.id} display={chat.display} lastMessageText={chat.lastMessageText ?? ""} time={chat.time} managers={managers} currentManagerId={chat.currentManagerId} status={chat.status} escalationStatus={chat.escalationStatus} escalatedAt={chat.escalatedAt} unreadCount={chat.unreadCount} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500">
            {chats.length === 0 ? "Чатов пока нет" : "Ничего не найдено"}
          </div>
        )}
      </main>
    </div>
  );
}
