"use client";

import { useState, useTransition } from "react";
import { updateClientTags } from "@/features/client-tags/api/actions";

const PRESET_TAGS = ["VIP", "Жалоба", "Технический", "Новичок", "Постоянный"];

export default function ClientTags({ clientId, initialTags }: { clientId: number; initialTags: string[] }) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();

  function applyTags(next: string[]) {
    setTags(next);
    start(() => updateClientTags(clientId, next));
  }

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    applyTags([...tags, trimmed]);
    setInput("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400">
          {tag}
          <button type="button" onClick={() => applyTags(tags.filter((t) => t !== tag))} disabled={pending} className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 leading-none" aria-label={`Удалить метку ${tag}`}>×</button>
        </span>
      ))}
      <div className="relative group">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(input); } }} placeholder="+ Метка"
          className="w-20 text-xs px-2 py-0.5 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:w-28 transition-all"
        />
        {input.trim() && <button type="button" onClick={() => addTag(input)} disabled={pending} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-blue-500 hover:text-blue-700">✓</button>}
      </div>
      {PRESET_TAGS.filter((t) => !tags.includes(t)).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {PRESET_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
            <button key={tag} type="button" onClick={() => addTag(tag)} disabled={pending} className="text-[10px] px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-blue-300 hover:text-blue-500 transition-colors">{tag}</button>
          ))}
        </div>
      )}
    </div>
  );
}
