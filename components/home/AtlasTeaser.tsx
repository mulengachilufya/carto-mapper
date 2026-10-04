import Link from "next/link";
import { PosterCard } from "@/components/marketing/AtlasGallery";

const WHO = ["Finance", "Real estate", "Retail", "Healthcare", "Fashion", "Energy", "Tourism", "Telecoms", "Newsrooms", "Education", "NGOs", "Startups"];

/** Proof, poster-style: live engine maps framed the way people actually share them. */
export function AtlasTeaser() {
  return (
    <section className="relative overflow-hidden bg-[#0b1412] py-24 text-atlas-paper lg:py-32">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(232,184,106,.18),transparent)]" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-3xl">
            <p className="eyebrow text-atlas-ochre">Made with CartoMapper</p>
            <h2 className="display mt-4 text-5xl font-medium leading-[0.98] tracking-tight sm:text-7xl">
              Maps people <em className="font-normal text-atlas-ochre">stop scrolling for.</em>
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-atlas-paper/70">
              Not another grey GIS map. Type a sentence, drop in your numbers, and get something worth putting in the deck, the
              report or the feed. Every map below was drawn live by the engine, in your browser.
            </p>
          </div>
          <Link href="/atlas" className="inline-flex h-12 items-center rounded-full bg-atlas-paper px-6 font-semibold text-atlas-ink transition-colors hover:bg-white">
            See the full gallery →
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap gap-2">
          {WHO.map((w) => (
            <span key={w} className="rounded-full border border-atlas-paper/15 px-3.5 py-1.5 text-sm text-atlas-paper/75">
              {w}
            </span>
          ))}
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-2 lg:gap-10">
          <div className="space-y-8 lg:space-y-10">
            <PosterCard id="world-millionaires" />
            <PosterCard id="uk-stores" />
          </div>
          <div className="space-y-8 md:mt-24 lg:space-y-10">
            <PosterCard id="us-home-prices" />
            <PosterCard id="brazil-coffee" />
          </div>
        </div>
      </div>
    </section>
  );
}
