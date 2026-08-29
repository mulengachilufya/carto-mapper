import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative mt-auto overflow-hidden border-t border-room-line bg-room">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/media/world-mono.png" alt="" className="h-full w-full object-cover object-center" />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-serif text-lg text-paper">CartoMapper</p>
            <p className="mt-1.5 max-w-xs text-sm text-parchment-muted">
              Cartography, by design. Every map runs through the same equal-area, ColorBrewer, honest-classification
              pipeline — yours included.
            </p>
          </div>

          <nav className="flex gap-x-10 gap-y-2 text-sm text-parchment-muted sm:gap-x-12">
            <div className="space-y-2.5">
              <p className="font-mono-tight text-[10px] uppercase tracking-wider text-brass">Product</p>
              <Link href="/#examples" className="block transition-colors hover:text-paper">Examples</Link>
              <Link href="/#how" className="block transition-colors hover:text-paper">How it works</Link>
              <Link href="/#pricing" className="block transition-colors hover:text-paper">Pricing</Link>
            </div>
            <div className="space-y-2.5">
              <p className="font-mono-tight text-[10px] uppercase tracking-wider text-brass">Start</p>
              <Link href="/create" className="block transition-colors hover:text-paper">Create a map</Link>
            </div>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-room-line pt-6 text-xs text-parchment-muted sm:flex-row sm:items-center">
          <p className="font-mono-tight">Boundaries © Natural Earth</p>
          <p className="font-mono-tight">© {new Date().getFullYear()} CartoMapper</p>
        </div>
      </div>
    </footer>
  );
}
