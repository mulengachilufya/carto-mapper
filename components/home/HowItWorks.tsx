import Image from "next/image";
import { SectionHeading } from "./SectionHeading";

const STEPS = [
  {
    gate: "Free",
    title: "Tell us the map",
    body: "One sentence is enough — “health facilities across Ghana, sized by patients”. Add any data you have: CSV or Excel, a PDF report, a pasted list of places, even a photo of a printed table.",
  },
  {
    gate: "Free",
    title: "The engine reads and decides",
    body: "It finds the places in your data — countries, provinces, districts, towns or coordinates — and makes the calls a cartographer would: projection, level of detail, classification, palette, style and layout.",
  },
  {
    gate: "Free",
    title: "Preview and refine",
    body: "Switch style, page size or orientation, toggle map elements, and ask for changes in plain words — “make it green”, “use natural breaks”. The engine explains why it drew the map the way it did.",
  },
  {
    gate: "Yours",
    title: "Download print-ready files",
    body: "A vector PDF at A4 or Letter for print and an SVG for your designer — no watermark, no charge. Every map is saved to your account to open and download again.",
  },
];

const DECISIONS = [
  ["Projection", "Equal-area, fitted to your region"],
  ["Geography", "Country, province, district or points"],
  ["Classes", "Quantile, equal interval or natural breaks"],
  ["Colour", "ColorBrewer ramps matched to the data"],
  ["Reference", "Relief, rivers, cities, seas, peaks"],
  ["Layout", "Legend placed where it hides nothing"],
];

export function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden bg-atlas-forest py-24 text-atlas-paper lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-16 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <SectionHeading
            tone="dark"
            eyebrow="How it works"
            title={
              <>
                From a sentence to a <em className="font-normal text-atlas-sage">printed plate.</em>
              </>
            }
            sub="Free from the first sentence to the final PDF. Sign up once, then make up to ten maps a day."
          />
          <div className="photo plate mt-10 hidden aspect-[3/4] max-w-sm -rotate-1 lg:block">
            <Image src="/media/figure-06.jpg" alt="An old framed map on a wall, crossed by window light" fill sizes="384px" className="object-cover p-[10px]" />
          </div>
        </div>

        <div>
          <ol className="relative space-y-10 border-l border-atlas-paper/15 pl-10">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <span className="absolute -left-[3.05rem] top-0 flex h-8 w-8 items-center justify-center rounded-full border border-atlas-ochre/60 bg-atlas-forest font-mono text-xs text-atlas-ochre">
                  {i + 1}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="display text-2xl font-semibold">{s.title}</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${
                      s.gate === "Yours" ? "bg-atlas-green/80 text-atlas-pine" : "border border-atlas-paper/25 text-atlas-paper/70"
                    }`}
                  >
                    {s.gate}
                  </span>
                </div>
                <p className="mt-2 max-w-xl leading-relaxed text-atlas-paper/70">{s.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-14 border border-atlas-paper/15 p-7">
            <p className="eyebrow text-atlas-ochre">What the engine decides for you</p>
            <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {DECISIONS.map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-24 shrink-0 font-mono text-xs uppercase tracking-wider text-atlas-sage/80">{k}</dt>
                  <dd className="text-sm text-atlas-paper/75">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
