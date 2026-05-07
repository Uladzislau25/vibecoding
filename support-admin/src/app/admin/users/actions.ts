"use server";

import { supabase } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type UserRole = "admin" | "manager" | "user";

export async function updateUserRole(managerId: number, role: UserRole) {
  await requireRole("admin");

  const { error } = await supabase
    .from("managers")
    .update({ role })
    .eq("id", managerId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}
