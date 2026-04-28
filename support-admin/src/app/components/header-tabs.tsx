"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Сообщения", match: (p: string) => p === "/" || p.startsWith("/chat") },
  { href: "/recipes", label: "База рецептов", match: (p: string) => p.startsWith("/recipes") },
  { href: "/history", label: "История", match: (p: string) => p.startsWith("/history") },
];

export default function HeaderTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              active
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
