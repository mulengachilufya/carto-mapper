import Link from "next/link";
import { CompassMark } from "./CompassMark";

const NAV = [
  { href: "/atlas", label: "The Atlas" },
  { href: "/#styles", label: "Map styles" },
  { href: "/#how", label: "How it works" },
  { href: "/#who", label: "Who it's for" },
  { href: "/#pricing", label: "Pricing" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-atlas-rule/70 bg-atlas-paper/88 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <CompassMark />
          <span className="display text-[1.3rem] font-semibold text-atlas-ink">CartoMapper</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-atlas-ink-2 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="transition-colors hover:text-atlas-ocean">
              {n.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/create"
          className="inline-flex h-10 items-center rounded-full bg-atlas-deep px-5 text-sm font-medium text-atlas-paper transition-colors hover:bg-atlas-ocean"
        >
          Make a map
        </Link>
      </div>
    </header>
  );
}
