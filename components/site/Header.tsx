import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-[--color-line] bg-[--color-paper]/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Compass />
          <span className="font-serif text-lg font-semibold tracking-tight">CartoMapper</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-[--color-muted] md:flex">
          <Link href="/#examples" className="hover:text-[--color-ink]">Examples</Link>
          <Link href="/#how" className="hover:text-[--color-ink]">How it works</Link>
          <Link href="/#pricing" className="hover:text-[--color-ink]">Pricing</Link>
        </nav>
        <Button href="/create" size="sm">Create my map</Button>
      </div>
    </header>
  );
}

function Compass() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <circle cx="13" cy="13" r="11.25" stroke="var(--color-accent)" strokeWidth="1.5" />
      <polygon points="13,5 15.5,13 13,21 10.5,13" fill="var(--color-accent)" />
      <polygon points="13,5 13,13 10.5,13" fill="var(--color-accent-2)" />
      <circle cx="13" cy="13" r="1.4" fill="var(--color-paper)" />
    </svg>
  );
}
