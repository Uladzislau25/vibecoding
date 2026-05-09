"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Role = "admin" | "manager" | "user";

const ALL_TABS = [
  { href: "/", label: "Сообщения", match: (p: string) => p === "/" || p.startsWith("/chat"), roles: ["admin", "manager"] },
  { href: "/recipes", label: "База рецептов", match: (p: string) => p.startsWith("/recipes"), roles: ["admin", "manager", "user"] },
  { href: "/dashboard", label: "Дашборд", match: (p: string) => p.startsWith("/dashboard"), roles: ["admin", "manager"] },
  { href: "/history", label: "История", match: (p: string) => p.startsWith("/history"), roles: ["admin", "manager"] },
  { href: "/stats", label: "Статистика", match: (p: string) => p.startsWith("/stats"), roles: ["admin", "manager"] },
  { href: "/admin/users", label: "Пользователи", match: (p: string) => p.startsWith("/admin"), roles: ["admin"] },
];

export default function HeaderTabs({ role }: { role: Role }) {
  const pathname = usePathname();
  const tabs = ALL_TABS.filter((t) => t.roles.includes(role));

  return (
    <nav className="hidden md:flex items-center gap-1">
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              active
                ? "bg-gray-900 text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
