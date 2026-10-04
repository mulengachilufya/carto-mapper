import Image from "next/image";
import Link from "next/link";

const COLUMNS = [
  {
    title: "Make",
    links: [
      { href: "/create", label: "Make a map" },
      { href: "/atlas", label: "Gallery" },
      { href: "/how-it-works#styles", label: "Map styles" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/how-it-works#who", label: "Who it's for" },
      { href: "/how-it-works#faq", label: "Questions" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/#free", label: "Free, 10 maps a day" },
      { href: "/signup", label: "Create an account" },
      { href: "/account", label: "My maps" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative mt-auto overflow-hidden bg-atlas-pine text-atlas-paper">
      <Image src="/media/world-mono.png" alt="" fill sizes="100vw" className="object-cover opacity-[0.06]" />
      <div className="relative mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_2fr]">
          <div>
            <p className="display text-2xl font-semibold">CartoMapper</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-atlas-paper/65">
              Maps worth sharing, of anywhere on Earth, from whatever data you have. Bold, honest and on-brand, in
              minutes, not weeks.
            </p>
          </div>
          <nav className="grid grid-cols-3 gap-6 text-sm">
            {COLUMNS.map((c) => (
              <div key={c.title} className="space-y-2.5">
                <p className="eyebrow text-atlas-ochre">{c.title}</p>
                {c.links.map((l) => (
                  <Link key={l.href} href={l.href} className="block text-atlas-paper/70 transition-colors hover:text-atlas-paper">
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-atlas-paper/10 pt-6 tabular-nums text-[11px] text-atlas-paper/45 sm:flex-row sm:justify-between">
          <p>
            Boundaries © Natural Earth · Subdivisions © geoBoundaries (CC BY 4.0) · Terrain © Mapzen Terrain Tiles
          </p>
          <p>© {new Date().getFullYear()} CartoMapper</p>
        </div>
      </div>
    </footer>
  );
}
