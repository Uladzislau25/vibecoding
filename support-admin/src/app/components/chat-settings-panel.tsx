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

const MODELS: { value: ChatSettingsInput["model"]; label: string }[] = [
  { value: "deepseek-chat", label: "deepseek-chat" },
  { value: "deepseek-reasoner", label: "deepseek-reasoner" },
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
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm">
      <div className="flex items-center justify-between px-5 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
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
            <span className="text-xs text-gray-400">сохранение…</span>
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
              ? "border-red-200 text-red-600 hover:bg-red-50"
              : "border-green-200 text-green-600 hover:bg-green-50"
          }`}
        >
          {status === "open" ? "Закрыть чат" : "Открыть чат"}
        </button>
      </div>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-600">Модель</span>
            <select
              value={settings.model}
              onChange={(e) =>
                commit({
                  ...settings,
                  model: e.target.value as ChatSettingsInput["model"],
                })
              }
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">
                Температура
              </span>
              <span className="text-xs text-gray-500 tabular-nums">
                {settings.temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.1}
              value={settings.temperature}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  temperature: Number(e.target.value),
                })
              }
              onMouseUp={() => commit(settings)}
              onTouchEnd={() => commit(settings)}
              onKeyUp={() => commit(settings)}
              className="w-full accent-blue-500"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-600">Max tokens</span>
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
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-600">
              System prompt
            </span>
            <textarea
              value={settings.system_prompt}
              onChange={(e) =>
                setSettings({ ...settings, system_prompt: e.target.value })
              }
              onBlur={() => commit(settings)}
              rows={6}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors resize-y"
            />
          </label>
        </div>
      )}
    </div>
  );
}
