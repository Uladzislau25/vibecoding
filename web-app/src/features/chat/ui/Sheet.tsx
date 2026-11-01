"use client";

import type { ReactNode } from "react";

export default function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-2xl mx-auto bg-white dark:bg-gray-900 rounded-t-2xl border-t border-gray-200 dark:border-gray-800 max-h-[80dvh] flex flex-col pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="font-semibold text-gray-900 dark:text-gray-100">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3">{children}</div>
      </div>
    </div>
  );
}
