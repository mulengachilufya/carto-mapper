import Image from "next/image";
import { SectionHeading } from "./SectionHeading";

const SCALES = [
  {
    img: "/media/earth-dark.jpg",
    alt: "The whole Earth floating in space",
    ratio: "1 : 100 000 000",
    title: "The world",
    body: "Every country on an equal-area globe: no Mercator distortion, so Africa and Greenland finally look their real size.",
  },
  {
    img: "/media/world-geo.jpg",
    alt: "A physical world map with relief and ocean depths",
    ratio: "1 : 20 000 000",
    title: "A continent or region",
    body: "Lambert azimuthal projections centred on your region: Europe, Southeast Asia, the Americas, the Gulf.",
  },
  {
    img: "/media/figure-07.jpg",
    alt: "Aerial view of farmland, a village and a railway line",
    ratio: "1 : 2 000 000",
    title: "A country, its provinces, its districts",
    body: "Official boundaries for 199 countries down to district level — shade the 47 prefectures of Japan, the 3,000 counties of the US or the 33 boroughs of London.",
  },
  {
    img: "/media/figure-05.jpg",
    alt: "Aerial view of a town's streets and rooftops",
    ratio: "1 : 250 000",
    title: "Your sites",
    body: "Clinics, schools, stores, stations — placed from coordinates or just their names, labelled without collisions.",
  },
];

export function ScaleJourney() {
  return (
    <section id="scales" className="atlas-grain bg-atlas-paper py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="From orbit to street"
          title={
            <>
              One engine. <em className="font-normal text-atlas-leather">Every scale.</em>
            </>
          }
          sub="Whether your story spans the planet or a single district, CartoMapper picks the projection, the level of detail and the reference layers a professional cartographer would."
        />
        <ol className="relative mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* the zoom line */}
          <div aria-hidden className="absolute left-0 right-0 top-[7.5rem] hidden border-t border-dashed border-atlas-moss/40 lg:block" />
          {SCALES.map((s, i) => (
            <li key={s.title} className="relative">
              <div className="photo plate aspect-[4/5]" style={{ transform: `rotate(${[-1.2, 0.8, -0.6, 1][i]}deg)` }}>
                <Image src={s.img} alt={s.alt} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover p-[10px]" />
              </div>
              <p className="mt-6 font-mono text-xs tracking-wider text-atlas-moss">{s.ratio}</p>
              <h3 className="display mt-1.5 text-2xl font-semibold text-atlas-ink">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-atlas-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
