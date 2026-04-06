"use server";

import { createSupabaseServer } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export async function updatePassword(formData: FormData) {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) {
    redirect("/reset-password?error=" + encodeURIComponent("Пароли не совпадают"));
  }

  if (password.length < 6) {
    redirect("/reset-password?error=" + encodeURIComponent("Пароль должен быть не менее 6 символов"));
  }

  const supabase = await createSupabaseServer();

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect("/reset-password?error=" + encodeURIComponent(error.message));
  }

  redirect("/");
}
