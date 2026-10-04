import Link from "next/link";
import { CompassMark } from "./CompassMark";
import { AccountNav } from "./AccountNav";

const NAV = [
  { href: "/atlas", label: "Gallery" },
  { href: "/how-it-works#styles", label: "Map styles" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/how-it-works#who", label: "Who it's for" },
  { href: "/#free", label: "Free" },
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
            <Link key={n.href} href={n.href} className="transition-colors hover:text-atlas-moss">
              {n.label}
            </Link>
          ))}
        </nav>
        <AccountNav />
      </div>
    </header>
  );
}
