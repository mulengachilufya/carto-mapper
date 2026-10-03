import Image from "next/image";
import Link from "next/link";

const PROOF = [
  ["199", "countries, down to provinces & districts"],
  ["7,342", "cities & towns placed and named"],
  ["30 m", "terrain relief, land and sea floor"],
  ["< 3 min", "from a sentence to a print-ready PDF"],
];

/** The first screen: one line of promise and the button, over the Earth at night. */
export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden bg-atlas-pine text-atlas-paper">
      <Image src="/media/earth-dark.jpg" alt="" fill preload sizes="100vw" className="object-cover object-center opacity-80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(14,38,32,0.35)_0%,rgba(14,38,32,0.85)_75%)]" />

      <div className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-5 py-16 text-center">
        <p className="eyebrow inline-flex items-center gap-2 text-atlas-ochre">
          <span className="h-1.5 w-1.5 rounded-full bg-atlas-ochre" /> The atlas, on demand
        </p>
        <h1 className="display mt-5 text-[2.7rem] font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
          Put your world <em className="font-normal text-atlas-sage">on the map.</em>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-atlas-paper/80">
          Any place on Earth, any data. Describe it in a sentence and get an atlas-grade, print-ready map in three
          minutes — real terrain, rivers, place names and a legend that means something.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/create"
            className="inline-flex h-14 items-center rounded-full bg-atlas-leather px-10 text-lg font-semibold text-atlas-paper transition-colors hover:bg-atlas-leather-2"
          >
            Make my map
          </Link>
          <Link
            href="/atlas"
            className="inline-flex h-14 items-center rounded-full border border-atlas-paper/30 px-8 text-base text-atlas-paper transition-colors hover:bg-atlas-paper/10"
          >
            See example maps
          </Link>
        </div>
        <p className="mt-4 text-sm text-atlas-paper/60">Free for everyone · up to 10 maps a day · no card</p>
      </div>

      <div className="relative border-t border-atlas-paper/10 bg-atlas-pine/70 backdrop-blur-sm">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-y-5 px-5 py-6 lg:grid-cols-4 lg:px-8">
          {PROOF.map(([n, label]) => (
            <div key={label} className="pr-6">
              <dt className="display text-2xl font-semibold text-atlas-paper sm:text-3xl">{n}</dt>
              <dd className="mt-1 text-sm text-atlas-paper/60">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
