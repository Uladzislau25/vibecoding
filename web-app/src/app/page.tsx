import { createSupabaseServer } from "@/shared/api/supabase-server";
import { logout } from "@/features/auth/api/actions";
import ChatClient, { type ChatMessage } from "@/features/chat/ui/ChatClient";

export default async function HomePage() {
  const supabase = await createSupabaseServer();

  // RLS (messages_web_self) restricts this to the current user's own messages.
  const { data } = await supabase
    .from("messages")
    .select("text, sender_type, recipe_id, created_at")
    .order("created_at", { ascending: true })
    .limit(50);

  const initialMessages: ChatMessage[] = (data ?? []).map((m) => ({
    role: m.sender_type === "bot" ? "bot" : "user",
    text: m.text,
    recipeId: m.recipe_id,
  }));

  return (
    <div className="flex flex-col h-dvh max-w-2xl mx-auto bg-white dark:bg-gray-900 sm:border-x border-gray-200 dark:border-gray-800">
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-lg">🍳</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">ChefBot</span>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Выйти
          </button>
        </form>
      </header>

      <ChatClient initialMessages={initialMessages} />
    </div>
  );
}
