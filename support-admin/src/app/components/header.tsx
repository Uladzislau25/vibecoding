import { createSupabaseServer } from "@/lib/supabase-server";
import { logout } from "@/app/login/actions";
import HeaderNav from "./header-nav";
import HeaderTabs from "./header-tabs";

export default async function Header() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-10 backdrop-blur-md bg-white/80 border-b border-gray-200/40 relative will-change-transform">
      <div className="mx-auto px-4 md:px-[120px] py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-6 min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 shrink-0">
            SupportBot
          </h1>
          <HeaderTabs />
        </div>
        <HeaderNav email={user.email!} logoutAction={logout} />
      </div>
    </header>
  );
}
