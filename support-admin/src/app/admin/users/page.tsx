import { supabase } from "@/shared/api/supabase-anon";
import { getUserRole } from "@/shared/lib/auth";
import { notFound } from "next/navigation";
import UsersManager from "@/features/user-management/ui/UsersManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Пользователи" };

export default async function AdminUsersPage() {
  const role = await getUserRole();
  if (role !== "admin") notFound();

  const { data: usersRaw } = await supabase
    .from("managers")
    .select("id, name, position, role, created_at")
    .order("created_at", { ascending: false });

  const users = usersRaw ?? [];

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-950">
      <main className="max-w-4xl mx-auto px-6 py-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Управление пользователями
        </h1>
        <UsersManager users={users} />
      </main>
    </div>
  );
}
