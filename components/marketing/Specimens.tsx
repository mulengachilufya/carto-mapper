import { Plate } from "@/components/marketing/Plate";
import { Reveal } from "@/components/marketing/Reveal";

const FIGURES: { src: string; alt: string; fig: string; ratio?: string; rotate?: number }[] = [
  { src: "/media/globe-museum.jpg", alt: "A physical relief globe", fig: "Fig. 1", ratio: "4 / 5", rotate: -1.5 },
  { src: "/media/atlas-compass.jpg", alt: "An antique European atlas beside a compass", fig: "Fig. 2", ratio: "3 / 4", rotate: 1 },
  { src: "/media/world-colorful.jpg", alt: "A colourful world map", fig: "Fig. 3", ratio: "16 / 10", rotate: -0.75 },
  { src: "/media/topo-brazil.jpg", alt: "A 3D topographic rendering of Brazil", fig: "Fig. 4", ratio: "1 / 1", rotate: 1.5 },
  { src: "/media/figure-05.jpg", alt: "From the CartoMapper reference archive", fig: "Fig. 5", ratio: "4 / 5", rotate: -1 },
  { src: "/media/figure-06.jpg", alt: "From the CartoMapper reference archive", fig: "Fig. 6", ratio: "3 / 4", rotate: 0.75 },
  { src: "/media/figure-07.jpg", alt: "From the CartoMapper reference archive", fig: "Fig. 7", ratio: "16 / 10", rotate: -1.25 },
  { src: "/media/figure-08.jpg", alt: "From the CartoMapper reference archive", fig: "Fig. 8", ratio: "4 / 5", rotate: 1 },
];

export function Specimens() {
  return (
    <section id="archive" className="film-grain relative border-b border-room-line bg-room py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <p className="font-mono-tight text-xs uppercase tracking-wider text-brass">The reference shelf</p>
          <h2 className="mt-2 max-w-xl font-serif text-3xl font-semibold tracking-tight text-paper">
            Every convention we hold your map to has a physical original
          </h2>
          <p className="mt-3 max-w-xl text-parchment-muted">
            Globes, survey instruments, hand-set atlases — the vocabulary of real cartography, before any of it
            touched a screen.
          </p>
        </Reveal>
      </div>

      <div className="mt-10 overflow-x-auto pb-4 [scrollbar-width:thin]">
        <div className="mx-auto flex w-max max-w-none gap-6 px-5 sm:px-[max(1.25rem,calc((100vw-72rem)/2+1.25rem))]">
          {FIGURES.map((f, i) => (
            <Reveal key={f.fig} delay={i * 70} className="w-[220px] shrink-0 sm:w-[260px]">
              <Plate src={f.src} alt={f.alt} plate={f.fig} ratio={f.ratio} rotate={f.rotate} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
