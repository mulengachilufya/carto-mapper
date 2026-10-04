import { PosterCard } from "@/components/marketing/AtlasGallery";
import { SectionHeading } from "./SectionHeading";

const LOOKS = [
  { name: "Editorial", plate: "us-home-prices", line: "Flat land, crisp white borders, bold colour. The newsroom graphic, and the engine's default for data." },
  { name: "Night", plate: "world-millionaires", line: "A dark ground where your data glows. Launches, decks and anything headed for a feed." },
  { name: "Dots", plate: "europe-chargers", line: "Land and data printed as a dot matrix. Poster-ready, and nobody else's map looks like it." },
  { name: "Atlas", plate: "peru-physical", line: "Relief, rivers and peaks, only when you ask for them. For textbooks, guides and physical maps." },
];

const MORE = [
  ["Classic", "Political pastels, every country its own colour."],
  ["Minimal", "Paper and ink, for journals and annual reports."],
  ["Your words", "“Make it dark”, “dotted”, “magazine style”, “in our brand green”."],
];

export function Styles() {
  return (
    <section id="styles" className="relative overflow-hidden bg-atlas-card py-24 lg:py-32">
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Six looks, one engine"
          title={
            <>
              Not a GIS screenshot. <em className="font-normal text-atlas-leather">Something you'd frame.</em>
            </>
          }
          sub="The engine picks the look that suits your data, or you pick one in a word. Every style keeps the rigour: honest projections, real class breaks, labels that never collide."
        />

        <div className="mt-16 grid gap-10 md:grid-cols-2">
          {LOOKS.map((l, i) => (
            <article key={l.name} className={i % 2 ? "md:mt-20" : ""}>
              <PosterCard id={l.plate} compact />
              <div className="mt-5 flex items-baseline gap-4">
                <span className="eyebrow shrink-0 text-atlas-leather">{String(i + 1).padStart(2, "0")}</span>
                <p className="text-atlas-ink-2">
                  <span className="display text-xl font-semibold text-atlas-ink">{l.name}.</span> {l.line}
                </p>
              </div>
            </article>
          ))}
        </div>

        <dl className="mt-20 grid gap-6 border-t border-atlas-rule pt-10 sm:grid-cols-3">
          {MORE.map(([k, v]) => (
            <div key={k}>
              <dt className="display text-xl font-semibold text-atlas-ink">{k}</dt>
              <dd className="mt-1 text-atlas-ink-2">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
