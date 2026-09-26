import { SectionHeading } from "./SectionHeading";

const FAQ = [
  {
    q: "What data can I give it?",
    a: "Almost anything with places in it: CSV or Excel files, a pasted list of names (countries, provinces, districts, cities), coordinates, a PDF or Word report, or a photo of a printed table. If you have no data, describe the map and we will draw it with illustrative sample data you can replace.",
  },
  {
    q: "Which places does it know?",
    a: "Every country; provinces, states and counties for 199 countries; districts for most of them; and over 7,000 cities and towns. Names are matched forgivingly — “Copperbelt Province”, “North Western” and “Kano State” all find their boundaries.",
  },
  {
    q: "Is it really print quality?",
    a: "Yes. You download a vector PDF at A4 or Letter — text and lines stay razor-sharp at any size — with terrain embedded at print resolution, plus an SVG for your designer.",
  },
  {
    q: "Can I use the maps commercially?",
    a: "Yes, the maps are yours. The source line credits the open data behind them — Natural Earth (public domain), geoBoundaries (CC BY 4.0) and Mapzen terrain — as their licences ask.",
  },
  {
    q: "What if the map isn't right?",
    a: "You see the finished map before you pay, and can change style, size and elements freely. After purchase, one revision in plain words is included — “make it green”, “use natural breaks”.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="bg-atlas-card py-24 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <SectionHeading eyebrow="Questions" title="Before you begin" />
        <div className="divide-y divide-atlas-rule border-y border-atlas-rule">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium text-atlas-ink">
                {f.q}
                <span className="text-2xl font-light text-atlas-ocean transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-2xl leading-relaxed text-atlas-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
