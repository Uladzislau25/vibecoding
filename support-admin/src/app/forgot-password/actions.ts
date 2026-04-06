"use server";

import { createSupabaseServer } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export async function resetPassword(formData: FormData) {
  const email = formData.get("email") as string;

  if (!email) {
    redirect("/forgot-password?error=" + encodeURIComponent("Введите email"));
  }

  const supabase = await createSupabaseServer();

  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });

  if (error) {
    redirect("/forgot-password?error=" + encodeURIComponent(error.message));
  }

  redirect("/forgot-password?message=" + encodeURIComponent("Ссылка для сброса пароля отправлена на email"));
}
