import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { MapList } from "@/components/account/MapList";
import { accountsEnabled, getCurrentUser } from "@/lib/supabase/server";
import { listOwnJobs } from "@/lib/jobs";
import { getUsage } from "@/lib/quota";

export const metadata = { title: "My maps — CartoMapper" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!accountsEnabled()) redirect("/create");
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const [maps, usage] = await Promise.all([listOwnJobs(user.id), getUsage(user.id)]);
  const firstName = (user.user_metadata?.first_name as string | undefined) ?? null;

  return (
    <>
      <Header />
      <main className="atlas-grain flex-1 bg-atlas-paper">
        <div className="mx-auto w-full max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow text-atlas-leather">Your atlas</p>
              <h1 className="display mt-2 text-4xl font-semibold text-atlas-ink sm:text-5xl">
                {firstName ? `${firstName}'s maps` : "My maps"}
              </h1>
              <p className="mt-2 text-atlas-ink-2">{user.email}</p>
            </div>
            <div className="w-full max-w-xs rounded-xl border border-atlas-rule bg-atlas-card p-5 sm:w-auto sm:min-w-72">
              <p className="text-xs font-semibold uppercase tracking-wider text-atlas-ink-2">New maps today</p>
              <p className="display mt-1 text-3xl font-semibold text-atlas-ink">
                {usage.used} <span className="text-lg font-normal text-atlas-ink-2">of {usage.limit}</span>
              </p>
              <div className="mt-3 flex gap-1" aria-hidden>
                {Array.from({ length: usage.limit }, (_, i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded-full ${i < usage.used ? "bg-atlas-moss" : "bg-atlas-rule"}`} />
                ))}
              </div>
              <p className="mt-2 text-xs text-atlas-ink-2">
                {usage.remaining > 0
                  ? `${usage.remaining} left in the last 24 hours. Changes and downloads don't count.`
                  : "You've used today's maps. A slot frees up 24 hours after each map."}
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/create"
              className="inline-flex h-11 items-center rounded-full bg-atlas-forest px-6 text-sm font-medium text-atlas-paper transition-colors hover:bg-atlas-moss"
            >
              + Make a new map
            </Link>
            <form action="/auth/signout" method="post">
              <button className="inline-flex h-11 items-center rounded-full px-5 text-sm text-atlas-ink-2 hover:bg-atlas-card hover:text-atlas-ink">
                Sign out
              </button>
            </form>
          </div>

          <MapList maps={maps} />
        </div>
      </main>
      <Footer />
    </>
  );
}
