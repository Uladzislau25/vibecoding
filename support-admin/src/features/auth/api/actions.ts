"use server";

import { createSupabaseServer } from "@/shared/api/supabase-server";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/");
}

export async function logout() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}

export async function resetPassword(formData: FormData) {
  const email = formData.get("email") as string;
  if (!email) redirect("/forgot-password?error=" + encodeURIComponent("Введите email"));

  const supabase = await createSupabaseServer();
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/`,
  });

  if (error) redirect("/forgot-password?error=" + encodeURIComponent(error.message));
  redirect("/forgot-password?message=" + encodeURIComponent("Ссылка для сброса пароля отправлена на email"));
}

export async function updatePassword(formData: FormData) {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword)
    redirect("/reset-password?error=" + encodeURIComponent("Пароли не совпадают"));
  if (password.length < 6)
    redirect("/reset-password?error=" + encodeURIComponent("Пароль должен быть не менее 6 символов"));

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) redirect("/reset-password?error=" + encodeURIComponent(error.message));
  redirect("/");
}
