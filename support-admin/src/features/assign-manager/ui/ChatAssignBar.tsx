"use client";

import { useState, useTransition } from "react";
import { assignManager } from "@/features/assign-manager/api/actions";

type Manager = { id: number; name: string; position: string };

type Props = {
  clientId: number;
  managers: Manager[];
  currentManagerId: number | null;
  currentUserId: number | null;
};

export default function ChatAssignBar({ clientId, managers, currentManagerId, currentUserId }: Props) {
  const [selected, setSelected] = useState(currentManagerId?.toString() ?? "");
  const [isPending, startTransition] = useTransition();

  function handleAssign(managerId: number | null) {
    setSelected(managerId?.toString() ?? "");
    startTransition(async () => { await assignManager(clientId, managerId); });
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
      <select value={selected} onChange={(e) => handleAssign(e.target.value ? Number(e.target.value) : null)} disabled={isPending} className="flex-1 min-w-0 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 transition-colors disabled:opacity-50">
        <option value="">— Не назначен —</option>
        {managers.map((m) => (
          <option key={m.id} value={m.id}>{m.name}{m.position ? ` · ${m.position}` : ""}</option>
        ))}
      </select>

      {currentUserId !== null && (
        <button type="button" disabled={isPending || selected === currentUserId.toString()} onClick={() => handleAssign(currentUserId)} className="px-3 py-1.5 text-sm font-medium rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          Взять себе
        </button>
      )}

      {!!currentManagerId && (
        <button type="button" disabled={isPending} onClick={() => handleAssign(null)} className="px-3 py-1.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          Снять
        </button>
      )}
    </div>
  );
}
