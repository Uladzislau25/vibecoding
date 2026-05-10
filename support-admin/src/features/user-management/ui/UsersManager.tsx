"use client";

import { useTransition } from "react";
import { updateUserRole, type UserRole } from "@/features/user-management/api/actions";

type UserProfile = { id: number; name: string; position: string; role: string; created_at: string | null };

const ROLE_LABELS: Record<string, string> = { admin: "Администратор", manager: "Менеджер", user: "Пользователь" };
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  manager: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  user: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

function RoleSelector({ profile }: { profile: UserProfile }) {
  const [pending, start] = useTransition();
  return (
    <select value={profile.role} onChange={(e) => start(async () => { await updateUserRole(profile.id, e.target.value as UserRole); })} disabled={pending}
      className="text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-gray-700 dark:text-gray-300 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors disabled:opacity-50"
    >
      <option value="user">Пользователь</option>
      <option value="manager">Менеджер</option>
      <option value="admin">Администратор</option>
    </select>
  );
}

export default function UsersManager({ users }: { users: UserProfile[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Пользователей: <span className="font-medium text-gray-700 dark:text-gray-300">{users.length}</span>
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Имя</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Зарегистрирован</th>
              <th className="text-left px-4 py-3 font-medium">Роль</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{u.name}</div>
                  {u.position && u.position !== "user" && <div className="text-xs text-gray-500 dark:text-gray-400">{u.position}</div>}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${ROLE_COLORS[u.role] ?? ROLE_COLORS.user}`}>{ROLE_LABELS[u.role] ?? u.role}</span>
                    <RoleSelector profile={u} />
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={3} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500 text-sm">Нет зарегистрированных пользователей</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
