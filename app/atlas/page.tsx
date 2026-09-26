import Image from "next/image";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { AtlasGallery } from "@/components/marketing/AtlasGallery";

export const metadata = {
  title: "The Atlas — CartoMapper",
  description: "Specimen plates drawn live by the CartoMapper engine: relief, rivers, provinces and districts, across every continent.",
};

export default function AtlasPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-atlas-night text-atlas-paper">
          <Image src="/media/figure-09.jpg" alt="" fill preload sizes="100vw" className="object-cover opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-r from-atlas-night via-atlas-night/70 to-transparent" />
          <div className="relative mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
            <p className="eyebrow text-atlas-ochre">The Atlas</p>
            <h1 className="display mt-4 max-w-3xl text-5xl font-semibold leading-[1.02] sm:text-7xl">
              Plates from <em className="font-normal text-atlas-sea">every corner</em> of the Earth.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-atlas-paper/75">
              Each plate is rendered live in your browser by the engine that will draw your map — terrain fetched,
              rivers traced, names placed as you scroll. Data on these plates is illustrative.
            </p>
          </div>
        </section>
        <section className="atlas-grain bg-atlas-paper py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <AtlasGallery />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
