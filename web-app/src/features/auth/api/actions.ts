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

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    redirect("/signup?error=" + encodeURIComponent("Введите email и пароль"));
  }
  if (password.length < 6) {
    redirect("/signup?error=" + encodeURIComponent("Пароль должен быть не менее 6 символов"));
  }

  const supabase = await createSupabaseServer();
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  });

  if (error) redirect("/signup?error=" + encodeURIComponent(error.message));

  // If email confirmation is required there is no session yet.
  if (!data.session) {
    redirect("/login?message=" + encodeURIComponent("Проверьте почту и подтвердите email, затем войдите"));
  }
  redirect("/");
}

export async function logout() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
