import { Button } from "@/components/ui/Button";
import { FeaturedMap } from "@/components/marketing/Examples";
import { SectionPhoto } from "@/components/marketing/SectionPhoto";

export function Hero() {
  return (
    <section className="film-grain relative overflow-hidden border-b border-room-line bg-room">
      <SectionPhoto src="/media/hero-earth.jpg" alt="" kenBurns />
      {/* extra base scrim so text stays readable regardless of the photo's own tone */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-room/55 via-room/35 to-room" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-room-line bg-room-2/70 px-3 py-1 text-xs font-medium text-brass backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-brass" />
            Cartography, by design — not AI clip-art
          </p>
          <h1 className="font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-paper sm:text-5xl lg:text-[3.4rem]">
            Turn your data into a publication-quality map in&nbsp;60&nbsp;seconds.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-parchment-muted">
            Describe it in a sentence, drop in your data, and download a print-ready PDF that reads like a
            cartographer made it — proper projections, real colour ramps, a legend that means something.{" "}
            <span className="text-paper">$5 a map.</span>
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button href="/create" size="lg" className="bg-brass text-room hover:bg-brass/90">
              Create my map
            </Button>
            <Button
              href="#examples"
              variant="secondary"
              size="lg"
              className="border-room-line bg-transparent text-paper hover:bg-room-2"
            >
              See examples
            </Button>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-room-line pt-5 font-mono-tight text-xs text-parchment-muted">
            <span>13.98°S 28.63°E</span>
            <span className="h-1 w-1 rounded-full bg-room-line" />
            <span>$5 / map</span>
            <span className="h-1 w-1 rounded-full bg-room-line" />
            <span>1 free revision</span>
            <span className="h-1 w-1 rounded-full bg-room-line" />
            <span>no account needed</span>
          </div>
        </div>

        <div className="lg:pl-4">
          <div className="mx-auto max-w-md rotate-[1.25deg] transition-transform duration-500 hover:rotate-0">
            <FeaturedMap />
          </div>
        </div>
      </div>
    </section>
  );
}
