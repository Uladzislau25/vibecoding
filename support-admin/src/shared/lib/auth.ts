import { supabase as serviceClient } from "@/shared/api/supabase-anon";
import { createSupabaseServer } from "@/shared/api/supabase-server";

export type UserRole = "admin" | "manager" | "user";

export async function getUserRole(): Promise<UserRole | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await serviceClient
    .from("managers")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  return (data?.role as UserRole) ?? null;
}

export async function requireRole(...roles: UserRole[]): Promise<void> {
  const role = await getUserRole();
  if (!role || !roles.includes(role)) {
    throw new Error("Недостаточно прав");
  }
}
