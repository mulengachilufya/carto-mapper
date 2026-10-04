import Image from "next/image";
import { SectionHeading } from "./SectionHeading";

const AUDIENCES = [
  {
    img: "/media/figure-07.jpg",
    alt: "Aerial view of villages among fields",
    who: "Business, finance & property",
    line: "Store networks sized by sales, prices by district, where the money went — for the board pack and the investor deck.",
    eg: ["Store network", "Price per m²", "Sales by region"],
  },
  {
    img: "/media/figure-08.jpg",
    alt: "Aerial view of a dense town with red roofs",
    who: "Brands, fashion & marketing",
    line: "Pop-up tours, sell-out maps, where your customers really are — on-brand, in your colours, made for the feed.",
    eg: ["Launch tour", "Where it sold out", "Campaign reach"],
  },
  {
    img: "/media/world-geo.jpg",
    alt: "A physical map of the world",
    who: "Health, research & newsrooms",
    line: "Clinic coverage, outbreaks by county, results night — publication-ready, honestly classified, no GIS department required.",
    eg: ["Clinic coverage", "Cases by county", "Election results"],
  },
  {
    img: "/media/figure-09.jpg",
    alt: "Rolled antique maps on a wooden rack",
    who: "NGOs, teachers & students",
    line: "Where-we-work maps for the donor report, clean plates for the lesson, a thesis study area done properly.",
    eg: ["Where we work", "States of a country", "Thesis study area"],
  },
];

export function Audiences() {
  return (
    <section id="who" className="atlas-grain bg-atlas-paper py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Who it's for"
          title={
            <>
              For anyone with a place and a question. <em className="font-normal text-atlas-leather">No GIS required.</em>
            </>
          }
          sub="Hiring a cartographer takes weeks; desktop GIS takes months to learn. CartoMapper gives anyone the finished map in minutes."
        />
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map((a) => (
            <article key={a.who} className="group flex flex-col bg-atlas-card shadow-[0_1px_0_rgba(0,0,0,0.04),0_20px_40px_-28px_rgba(16,38,61,0.4)]">
              <div className="photo aspect-[4/3]">
                <Image src={a.img} alt={a.alt} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="display text-2xl font-semibold text-atlas-ink">{a.who}</h3>
                <p className="mt-2 flex-1 leading-relaxed text-atlas-ink-2">{a.line}</p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {a.eg.map((e) => (
                    <li key={e} className="rounded-full border border-atlas-rule px-3 py-1 text-xs text-atlas-ink-2">
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
