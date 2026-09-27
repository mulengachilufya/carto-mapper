import Image from "next/image";
import Link from "next/link";
import { SpecimenPlate } from "@/components/marketing/AtlasGallery";
import { SectionHeading } from "./SectionHeading";

export function AtlasTeaser() {
  return (
    <section className="relative overflow-hidden bg-atlas-pine py-24 text-atlas-paper lg:py-32">
      <Image src="/media/atlas-gold.jpg" alt="" fill sizes="100vw" className="object-cover opacity-55" />
      <div className="absolute inset-0 bg-gradient-to-b from-atlas-pine/85 via-atlas-pine/55 to-atlas-pine/90" />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            tone="dark"
            eyebrow="The Atlas"
            title={
              <>
                Plates drawn by the engine — <em className="font-normal text-atlas-sage">not by hand.</em>
              </>
            }
            sub="Every plate in the Atlas is rendered live, in your browser, by the same engine that will draw your map."
          />
          <Link href="/atlas" className="inline-flex h-12 items-center rounded-full border border-atlas-paper/30 px-6 text-atlas-paper transition-colors hover:bg-atlas-paper/10">
            Open all plates →
          </Link>
        </div>
        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <SpecimenPlate id="kenya-counties" caption={false} className="-rotate-[0.8deg]" />
          <SpecimenPlate id="france-wine" caption={false} className="rotate-[0.8deg] lg:mt-16" />
        </div>
      </div>
    </section>
  );
}
