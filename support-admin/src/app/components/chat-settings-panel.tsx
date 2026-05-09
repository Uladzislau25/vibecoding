"use client";

import { useState, useTransition } from "react";
import {
  updateChatSettings,
  updateChatStatus,
  type ChatSettingsInput,
} from "@/app/actions";

type Props = {
  clientId: number;
  initialSettings: ChatSettingsInput;
  initialStatus: "open" | "closed";
};

type ModelMeta = {
  value: ChatSettingsInput["model"];
  label: string;
  tier: string;
  tierClass: string;
  hint: string;
};

const MODELS: ModelMeta[] = [
  {
    value: "deepseek-chat",
    label: "deepseek-chat",
    tier: "Базовая",
    tierClass: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
    hint: "Быстрее всего, подходит для большинства задач",
  },
  {
    value: "deepseek-v3-0324",
    label: "deepseek-v3-0324",
    tier: "Мощная",
    tierClass: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",
    hint: "Сильная общая модель, лучше понимает контекст",
  },
  {
    value: "deepseek-reasoner",
    label: "deepseek-reasoner",
    tier: "Думает",
    tierClass: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
    hint: "Рассуждает пошагово, точнее в сложных вопросах",
  },
  {
    value: "deepseek-r1-0528",
    label: "deepseek-r1-0528",
    tier: "Топ",
    tierClass: "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400",
    hint: "Самая мощная, медленнее",
  },
];

export default function ChatSettingsPanel({
  clientId,
  initialSettings,
  initialStatus,
}: Props) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ChatSettingsInput>(initialSettings);
  const [status, setStatus] = useState<"open" | "closed">(initialStatus);
  const [savingSettings, startSaveSettings] = useTransition();
  const [savingStatus, startSaveStatus] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function commit(next: ChatSettingsInput) {
    setSettings(next);
    startSaveSettings(async () => {
      await updateChatSettings(clientId, next);
      setSavedAt(Date.now());
    });
  }

  function toggleStatus() {
    const next = status === "open" ? "closed" : "open";
    setStatus(next);
    startSaveStatus(async () => {
      await updateChatStatus(clientId, next);
    });
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm">
      <div className="flex items-center justify-between px-5 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${open ? "rotate-90" : ""}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          Настройки чата
          {savingSettings && (
            <span className="text-xs text-gray-400 dark:text-gray-500">сохранение…</span>
          )}
          {!savingSettings && savedAt && (
            <span className="text-xs text-green-600">сохранено</span>
          )}
        </button>

        <button
          type="button"
          onClick={toggleStatus}
          disabled={savingStatus}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
            status === "open"
              ? "border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              : "border-green-200 dark:border-green-800 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
          }`}
        >
          {status === "open" ? "Закрыть чат" : "Открыть чат"}
        </button>
      </div>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Модель</span>
            <div className="flex flex-col gap-1">
              {MODELS.map((m) => {
                const active = settings.model === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => commit({ ...settings, model: m.value })}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                      active
                        ? "border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className={`text-sm font-medium truncate ${active ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>
                        {m.label}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{m.hint}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium shrink-0 ${m.tierClass}`}>
                      {m.tier}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Max tokens</span>
            <input
              type="number"
              min={100}
              max={20000}
              step={500}
              value={settings.max_tokens}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  max_tokens: Number(e.target.value),
                })
              }
              onBlur={() => {
                const clamped = Math.max(
                  100,
                  Math.min(20000, settings.max_tokens || 100),
                );
                commit({ ...settings, max_tokens: clamped });
              }}
              className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
            />
          </label>
        </div>
      )}
    </div>
  );
}
