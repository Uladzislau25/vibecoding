"use client";

import { useTransition } from "react";
import { returnToBot } from "@/features/escalation/api/actions";

export default function ReturnToBotButton({ clientId }: { clientId: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => { await returnToBot(clientId); })}
      className="px-3 py-1.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isPending ? "…" : "Вернуть боту"}
    </button>
  );
}
