import Image from "next/image";
import { SpecimenPlate } from "@/components/marketing/AtlasGallery";
import { SectionHeading } from "./SectionHeading";

const STYLES = [
  {
    name: "Atlas",
    tag: "Physical",
    plate: "peru-stations",
    photos: [
      { src: "/media/atlas-compass.jpg", alt: "A physical atlas of Europe with a compass resting on it" },
      { src: "/media/topo-brazil.jpg", alt: "A relief model of Brazil in greens and browns" },
    ],
    lede: "The page you pored over in school: lowland greens rising to ochre uplands and snow-capped ranges, the sea deepening from shallow cyan to ocean blue.",
    points: [
      "Hypsometric tints and hillshade from global 30 m terrain",
      "Sea-floor depths, rivers and lakes thinned to your scale",
      "Your data colours keep the terrain's texture",
    ],
  },
  {
    name: "Classic",
    tag: "Political",
    plate: "east-africa-footprint",
    photos: [
      { src: "/media/globe-museum.jpg", alt: "An illuminated political globe showing Africa in pastel colours" },
      { src: "/media/world-colorful.jpg", alt: "A brightly coloured political world map" },
    ],
    lede: "The political map on the classroom wall: every country its own soft colour, coasts engraved with water lines, capitals marked with a ringed red dot.",
    points: [
      "Neighbour-aware pastel colouring — no two borders share a colour",
      "Water-lined coasts in the engraver's manner",
      "Countries, capitals and seas labelled in atlas type",
    ],
  },
  {
    name: "Minimal",
    tag: "Report",
    plate: "usa-minimal",
    photos: [{ src: "/media/world-mono.png", alt: "A black and white world map" }],
    lede: "For annual reports and journals where the data must be the only colour on the page. Paper, ink, hairlines — and nothing else competing.",
    points: [
      "Quiet paper-and-ink base map",
      "ColorBrewer palettes, honest class breaks",
      "Pairs with any brand guideline",
    ],
  },
];

export function Styles() {
  return (
    <section id="styles" className="relative overflow-hidden bg-atlas-card py-24 lg:py-32">
      <div className="graticule-bg pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Three looks, one engine"
          title={
            <>
              The atlases you grew up with — <em className="font-normal text-atlas-ocean">now for your data.</em>
            </>
          }
          sub="Pick a look, or let the engine choose. Every style carries the same cartographic rigour: equal-area projections, a real scale bar, labels that never collide."
        />

        <div className="mt-20 space-y-28">
          {STYLES.map((s, i) => (
            <article key={s.name} className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
              <div className={`min-w-0 ${i % 2 ? "lg:order-2" : ""}`}>
                <p className="eyebrow text-atlas-ocean">
                  Style {String(i + 1).padStart(2, "0")} · {s.tag}
                </p>
                <h3 className="display mt-3 text-5xl font-semibold text-atlas-ink">{s.name}</h3>
                <p className="mt-5 text-lg leading-relaxed text-atlas-ink-2">{s.lede}</p>
                <ul className="mt-6 space-y-2.5">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-3 text-atlas-ink-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-atlas-ochre" />
                      {p}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap items-end gap-4">
                  {s.photos.map((ph, j) => (
                    <figure key={ph.src} className="w-32 sm:w-40">
                      <div className="photo plate aspect-[4/3]" style={{ transform: `rotate(${j ? 2 : -2}deg)` }}>
                        <Image src={ph.src} alt={ph.alt} fill sizes="160px" className="object-cover p-[6px]" />
                      </div>
                    </figure>
                  ))}
                  <p className="atlas-label self-end pb-1 text-sm text-atlas-ink-2/80">
                    {s.photos.length > 1 ? "The inspiration" : "Inspiration"}
                  </p>
                </div>
              </div>
              <SpecimenPlate id={s.plate} caption={false} className={`min-w-0 ${i % 2 ? "lg:order-1" : ""}`} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
