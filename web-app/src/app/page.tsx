import { createSupabaseServer } from "@/shared/api/supabase-server";
import { logout } from "@/features/auth/api/actions";
import ChatClient, { type ChatMessage } from "@/features/chat/ui/ChatClient";
import PushToggle from "@/features/pwa/PushToggle";
import ThemeToggle from "@/features/theme/ThemeToggle";

export default async function HomePage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Scope history explicitly to this user's own web client. We must NOT rely on
  // RLS alone: an admin/manager Google account has broad messages_all access and
  // would otherwise see every client's messages mixed together.
  let initialMessages: ChatMessage[] = [];
  if (user) {
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("platform", "web")
      .maybeSingle();

    if (client) {
      const { data } = await supabase
        .from("messages")
        .select("text, sender_type, recipe_id, created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: true })
        .limit(50);

      initialMessages = (data ?? []).map((m) => ({
        role: m.sender_type === "bot" ? "bot" : "user",
        text: m.text,
        recipeId: m.recipe_id,
      }));
    }
  }

  return (
    <div className="flex flex-col h-dvh max-w-2xl mx-auto bg-white dark:bg-gray-900 sm:border-x border-gray-200 dark:border-gray-800">
      <header className="shrink-0 flex items-center justify-between px-4 pb-3 pt-[calc(env(safe-area-inset-top)+2rem)] border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <span className="text-lg">🍳</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">ChefBot</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <PushToggle />
          <form action={logout}>
            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Выйти
            </button>
          </form>
        </div>
      </header>

      <ChatClient initialMessages={initialMessages} />
    </div>
  );
}
