"use client";

import { useTransition } from "react";
import { returnToBot } from "@/app/actions";

type Props = {
  clientId: number;
};

export default function ReturnToBotButton({ clientId }: Props) {
  const [isPending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      await returnToBot(clientId);
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handle}
      className="px-3 py-1.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isPending ? "…" : "Вернуть боту"}
    </button>
  );
}
