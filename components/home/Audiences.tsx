import Image from "next/image";
import { SectionHeading } from "./SectionHeading";

const AUDIENCES = [
  {
    img: "/media/figure-07.jpg",
    alt: "Aerial view of villages among fields",
    who: "NGOs & development",
    line: "Programme footprints, beneficiaries by district, coverage gaps — for the donor report due on Friday.",
    eg: ["Where we work", "Beneficiaries by district", "Water points"],
  },
  {
    img: "/media/figure-08.jpg",
    alt: "Aerial view of a dense town with red roofs",
    who: "Cities, planning & property",
    line: "Sites, catchments and listings on a clean base, ready for the council pack or the investor deck.",
    eg: ["Store network", "Project sites", "Land parcels"],
  },
  {
    img: "/media/world-geo.jpg",
    alt: "A physical map of the world",
    who: "Research & journalism",
    line: "Publication-ready figures with honest classification and a cited source line — no GIS department required.",
    eg: ["Figure 3 of a paper", "A story's locator map", "Election results"],
  },
  {
    img: "/media/figure-09.jpg",
    alt: "Rolled antique maps on a wooden rack",
    who: "Teachers & students",
    line: "Atlas pages for the lesson, the thesis or the field trip — relief, rivers and names, exactly where they belong.",
    eg: ["Physical map of a country", "Trade routes", "Thesis study area"],
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
