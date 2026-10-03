import Image from "next/image";
import Link from "next/link";
import { SpecimenPlate } from "@/components/marketing/AtlasGallery";

const PROOF = [
  ["199", "countries, down to provinces & districts"],
  ["7,342", "cities & towns placed and named"],
  ["30 m", "terrain relief, land and sea floor"],
  ["< 3 min", "from a sentence to a print-ready PDF"],
];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-atlas-pine text-atlas-paper">
      <Image
        src="/media/hero-earth.jpg"
        alt="The Earth seen from orbit, oceans and cloud bands curving over the horizon"
        fill
        preload
        sizes="100vw"
        className="drift object-cover object-[60%_20%]"
      />
      {/* Legibility: night falls from the left and the bottom */}
      <div className="absolute inset-0 bg-gradient-to-r from-atlas-pine via-atlas-pine/80 to-atlas-pine/10" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-atlas-pine to-transparent" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-16 pt-12 lg:grid-cols-[1fr_1.05fr] lg:px-8 lg:pb-20 lg:pt-14">
        <div>
          <p className="eyebrow inline-flex items-center gap-2 text-atlas-ochre">
            <span className="h-1.5 w-1.5 rounded-full bg-atlas-ochre" /> The atlas, on demand
          </p>
          <h1 className="display mt-5 text-[2.6rem] font-semibold leading-[1.02] sm:text-[3.4rem] lg:text-[3.6rem] xl:text-[4rem]">
            Any place on Earth. Any data. <em className="font-normal text-atlas-sage">An atlas-grade map</em> in three
            minutes.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-atlas-paper/80">
            Describe it in a sentence, add any data you have. CartoMapper draws it the way the atlases you grew up with
            did — real terrain, rivers, place names, and a legend that means something.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/create"
              className="inline-flex h-[3.25rem] items-center rounded-full bg-atlas-leather px-8 text-base font-semibold text-atlas-paper transition-colors hover:bg-atlas-leather-2"
            >
              Make my map — it’s free
            </Link>
            <Link
              href="/atlas"
              className="inline-flex h-[3.25rem] items-center rounded-full border border-atlas-paper/30 px-7 text-base text-atlas-paper transition-colors hover:bg-atlas-paper/10"
            >
              Open the Atlas
            </Link>
          </div>
          <p className="mt-4 text-sm text-atlas-paper/55">Free for everyone. Sign up in seconds, make up to 10 maps a day.</p>
        </div>

        <div className="relative">
          <SpecimenPlate id="nepal-offices" caption={false} className="rotate-[1.2deg] lg:translate-x-4" />
          <p className="atlas-label absolute -bottom-9 right-2 text-sm text-atlas-paper/60">
            Plate 05 — drawn live by the engine, just now.
          </p>
        </div>
      </div>

      <div className="relative border-t border-atlas-paper/10 bg-atlas-pine/70 backdrop-blur-sm">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-y-6 px-5 py-7 lg:grid-cols-4 lg:px-8">
          {PROOF.map(([n, label]) => (
            <div key={label} className="pr-6">
              <dt className="display text-3xl font-semibold text-atlas-paper">{n}</dt>
              <dd className="mt-1 text-sm text-atlas-paper/60">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
