import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CompassMark } from "./CompassMark";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-room-line bg-room/92 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <CompassMark />
          <span className="font-serif text-lg font-semibold tracking-tight text-paper">CartoMapper</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-parchment-muted md:flex">
          <Link href="/#examples" className="transition-colors hover:text-paper">
            Examples
          </Link>
          <Link href="/#archive" className="transition-colors hover:text-paper">
            The archive
          </Link>
          <Link href="/#how" className="transition-colors hover:text-paper">
            How it works
          </Link>
          <Link href="/#pricing" className="transition-colors hover:text-paper">
            Pricing
          </Link>
        </nav>
        <Button href="/create" size="sm" className="bg-brass text-room hover:bg-brass/90">
          Create my map
        </Button>
      </div>
    </header>
  );
}
