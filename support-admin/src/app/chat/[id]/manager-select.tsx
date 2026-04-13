"use client";

import { useState, useTransition } from "react";
import { assignManager } from "./actions";

type Manager = {
  id: number;
  name: string;
  position: string;
};

export default function ManagerSelect({
  clientId,
  managers,
  currentManagerId,
}: {
  clientId: number;
  managers: Manager[];
  currentManagerId: number | null;
}) {
  const [selected, setSelected] = useState(currentManagerId?.toString() ?? "");
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setSelected(value);
    if (!value) return;
    startTransition(async () => {
      await assignManager(clientId, Number(value));
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">Менеджер:</span>
      <select
        value={selected}
        onChange={handleChange}
        disabled={isPending}
        className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors disabled:opacity-50"
      >
        <option value="">Не назначен</option>
        {managers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} — {m.position}
          </option>
        ))}
      </select>
      {isPending && (
        <span className="text-xs text-gray-400">Сохранение...</span>
      )}
    </div>
  );
}
