import { createSupabaseServer } from "@/lib/supabase-server";
import { logout } from "@/app/login/actions";
import HeaderNav from "./header-nav";

export default async function Header() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-10 backdrop-blur-xl bg-white/70 border-b border-gray-200/40 relative">
      <div className="mx-auto px-4 md:px-[120px] py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">
          SupportBot
        </h1>
        <HeaderNav email={user.email!} logoutAction={logout} />
      </div>
    </header>
  );
}
