import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CompassMark } from "@/components/site/CompassMark";

/**
 * The frame for sign-up, sign-in and password pages: an atlas plate on the left,
 * a paper card on the right. The plate collapses to a band on phones.
 */
export function AuthShell({ title, sub, children, footer }: { title: string; sub?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-atlas-paper lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-atlas-night text-atlas-paper lg:block">
        <Image src="/media/topo-brazil.jpg" alt="A shaded-relief topographic map" fill sizes="50vw" preload className="object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-atlas-night via-atlas-night/35 to-atlas-night/10" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-2.5">
            <CompassMark />
            <span className="display text-xl font-semibold">CartoMapper</span>
          </Link>
          <div className="max-w-md">
            <p className="eyebrow text-atlas-ochre">Free, for everyone</p>
            <p className="display mt-4 text-4xl font-semibold leading-tight">
              Any place on Earth. <em className="font-normal text-atlas-sea">An atlas-grade map</em> in three minutes.
            </p>
            <ul className="mt-8 space-y-2.5 text-atlas-paper/80">
              {["Up to 10 new maps every day", "Print-ready PDF and SVG, no watermark", "Your maps saved to your account"].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-atlas-green/80 text-[11px] text-atlas-night">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <p className="atlas-label text-sm text-atlas-paper/55">No card, no trial, no premium tier.</p>
        </div>
      </aside>

      <main className="atlas-grain flex flex-col items-center justify-center px-5 py-12">
        <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
          <CompassMark />
          <span className="display text-xl font-semibold text-atlas-ink">CartoMapper</span>
        </Link>
        <div className="w-full max-w-md">
          <h1 className="display text-4xl font-semibold text-atlas-ink">{title}</h1>
          {sub && <p className="mt-2 text-atlas-ink-2">{sub}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-atlas-ink-2">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

export const fieldClass =
  "w-full rounded-lg border border-atlas-rule bg-white/70 px-3.5 py-2.5 text-[15px] text-atlas-ink outline-none transition-colors placeholder:text-atlas-ink-2/50 focus:border-atlas-ocean focus:ring-1 focus:ring-atlas-ocean";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-atlas-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-atlas-ink-2/80">{hint}</span>}
    </label>
  );
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex h-12 w-full items-center justify-center rounded-full bg-atlas-deep text-[15px] font-semibold text-atlas-paper transition-colors hover:bg-atlas-ocean disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "ok"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border px-3.5 py-2.5 text-sm ${
        tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-atlas-green/40 bg-atlas-green/10 text-atlas-ink"
      }`}
    >
      {children}
    </p>
  );
}

export function AccountsOff() {
  return (
    <FormMessage tone="error">
      Accounts aren&apos;t switched on for this site yet (Supabase isn&apos;t configured). You can still{" "}
      <Link href="/create" className="underline">
        make a map
      </Link>
      .
    </FormMessage>
  );
}
