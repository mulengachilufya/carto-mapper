import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Two jobs, before any page renders:
 *  1. Keep the Supabase session cookie fresh.
 *  2. Send signed-out visitors to /signup (with ?next=) from the pages that make and
 *     keep maps, and signed-in ones past /login and /signup.
 *
 * Without Supabase configured the site runs open (local development).
 */
const GATED = ["/create", "/download", "/account"];
const AUTH_PAGES = ["/login", "/signup"];

const under = (path: string, prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

export async function proxy(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  // getUser() verifies the token with Supabase Auth (and refreshes it).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;

  if (!user && under(path, GATED)) {
    const to = new URL("/signup", req.url);
    to.searchParams.set("next", path + req.nextUrl.search);
    return NextResponse.redirect(to);
  }
  if (user && under(path, AUTH_PAGES)) {
    return NextResponse.redirect(new URL(safeNextPath(req.nextUrl.searchParams.get("next")), req.url));
  }
  return res;
}

export const config = {
  // Pages only: API routes check the user themselves; static files and media skip this.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|media|geodata|.*\\.(?:png|jpg|jpeg|svg|webp|json|topojson)$).*)"],
};
