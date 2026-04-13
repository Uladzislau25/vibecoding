"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { assignManager } from "@/app/actions";

type Manager = { id: number; name: string; position: string };

export default function ChatCard({
  clientId,
  display,
  lastMessageText,
  time,
  managers,
  currentManagerId,
}: {
  clientId: number;
  display: string;
  lastMessageText: string;
  time: string;
  managers: Manager[];
  currentManagerId: number | null;
}) {
  const [selected, setSelected] = useState(currentManagerId?.toString() ?? "");
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.preventDefault();
    e.stopPropagation();
    const value = e.target.value;
    setSelected(value);
    startTransition(async () => {
      await assignManager(clientId, value ? Number(value) : null);
    });
  }

  return (
    <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-200/80 px-5 py-4 shadow-sm hover:bg-gray-50 transition-colors">
      <Link
        href={`/chat/${clientId}`}
        className="flex items-center gap-4 flex-1 min-w-0"
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
          {display[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {display}
            </p>
            <time className="text-xs text-gray-400 whitespace-nowrap shrink-0">
              {time}
            </time>
          </div>
          <p className="text-sm text-gray-500 truncate mt-0.5">
            {lastMessageText}
          </p>
        </div>
      </Link>
      <div
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <select
          value={selected}
          onChange={handleChange}
          disabled={isPending}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors disabled:opacity-50 max-w-[120px]"
        >
          <option value="">—</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
