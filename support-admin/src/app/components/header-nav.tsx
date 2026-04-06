"use client";

import { useState } from "react";
import Link from "next/link";

export default function HeaderNav({
  email,
  logoutAction,
}: {
  email: string;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex items-center gap-4">
        <span className="text-sm text-gray-600">{email}</span>
        <Link
          href="/reset-password"
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 active:bg-gray-300 transition-colors"
        >
          Сменить пароль
        </Link>
        <form action={logoutAction}>
          <button className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 active:bg-gray-300 transition-colors cursor-pointer">
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
          className={`block h-0.5 w-5 bg-gray-700 rounded transition-transform ${open ? "translate-y-2 rotate-45" : ""}`}
        />
        <span
          className={`block h-0.5 w-5 bg-gray-700 rounded transition-opacity ${open ? "opacity-0" : ""}`}
        />
        <span
          className={`block h-0.5 w-5 bg-gray-700 rounded transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`}
        />
      </button>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-md border-b border-gray-200/60 px-4 py-4 flex flex-col gap-3 will-change-transform">
          <span className="text-sm text-gray-600">{email}</span>
          <Link
            href="/reset-password"
            onClick={() => setOpen(false)}
            className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 active:bg-gray-300 transition-colors text-center"
          >
            Сменить пароль
          </Link>
          <form action={logoutAction}>
            <button className="w-full rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 active:bg-gray-300 transition-colors cursor-pointer">
              Выйти
            </button>
          </form>
        </div>
      )}
    </>
  );
}
