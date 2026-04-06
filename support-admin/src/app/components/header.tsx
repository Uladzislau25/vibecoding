import { createSupabaseServer } from "@/lib/supabase-server";
import { logout } from "@/app/login/actions";

export default async function Header() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-10 backdrop-blur-xl bg-white/70 border-b border-gray-200/40">
      <div className="mx-auto px-4 md:px-[120px] py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">
          SupportBot
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user.email}</span>
          <form action={logout}>
            <button className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 active:bg-gray-300 transition-colors cursor-pointer">
              Выйти
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
