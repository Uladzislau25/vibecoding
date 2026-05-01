"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./theme-toggle";

const TABS = [
  { href: "/", label: "Сообщения", match: (p: string) => p === "/" || p.startsWith("/chat") },
  { href: "/recipes", label: "База рецептов", match: (p: string) => p.startsWith("/recipes") },
  { href: "/history", label: "История", match: (p: string) => p.startsWith("/history") },
  { href: "/stats", label: "Статистика", match: (p: string) => p.startsWith("/stats") },
];

export default function HeaderNav({
  email,
  logoutAction,
}: {
  email: string;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex items-center gap-4">
        <ThemeToggle />
        <span className="text-sm text-gray-600 dark:text-gray-400">{email}</span>
        <Link
          href="/reset-password"
          className="rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 transition-colors"
        >
          Сменить пароль
        </Link>
        <form action={logoutAction}>
          <button className="rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 transition-colors cursor-pointer">
            Выйти
          </button>
        </form>
      </div>

      {/* Mobile burger */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden flex flex-col justify-center gap-1.5 w-8 h-8 cursor-pointer"
        aria-label="Меню"
      >
        <span
          className={`block h-0.5 w-5 bg-gray-700 dark:bg-gray-300 rounded transition-transform ${open ? "translate-y-2 rotate-45" : ""}`}
        />
        <span
          className={`block h-0.5 w-5 bg-gray-700 dark:bg-gray-300 rounded transition-opacity ${open ? "opacity-0" : ""}`}
        />
        <span
          className={`block h-0.5 w-5 bg-gray-700 dark:bg-gray-300 rounded transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`}
        />
      </button>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200/60 dark:border-gray-700/60 px-4 py-4 flex flex-col gap-3 will-change-transform">
          <nav className="flex flex-col gap-1">
            {TABS.map((tab) => {
              const active = tab.match(pathname);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => setOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active ? "bg-gray-900 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          <ThemeToggle />
          <div className="border-t border-gray-200/60 dark:border-gray-700/60" />
          <span className="text-sm text-gray-600 dark:text-gray-400">{email}</span>
          <Link
            href="/reset-password"
            onClick={() => setOpen(false)}
            className="rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 transition-colors text-center"
          >
            Сменить пароль
          </Link>
          <form action={logoutAction}>
            <button className="w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 transition-colors cursor-pointer">
              Выйти
            </button>
          </form>
        </div>
      )}
    </>
  );
}
