import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabase as serviceClient } from "@/shared/api/supabase-anon";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const code = url.searchParams.get("code");

  if (code) {
    const response = NextResponse.redirect(new URL("/", request.url));

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SB_SECRET!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      }
    );

    const { data: sessionData } = await supabase.auth.exchangeCodeForSession(code);
    const user = sessionData?.user;

    if (user) {
      const { data: existing } = await serviceClient
        .from("managers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "User";

        await serviceClient.from("managers").insert({
          user_id: user.id,
          name,
          position: "user",
          role: "user",
        });

        const redirectResponse = NextResponse.redirect(new URL("/recipes", request.url));
        for (const cookie of response.cookies.getAll()) {
          redirectResponse.cookies.set(cookie.name, cookie.value);
        }
        return redirectResponse;
      }
    }

    return response;
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
