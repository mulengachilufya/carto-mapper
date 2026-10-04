import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { AtlasGallery } from "@/components/marketing/AtlasGallery";

export const metadata = {
  title: "Gallery · CartoMapper",
  description: "Maps drawn live by the CartoMapper engine for finance, retail, health, tourism, energy and more: editorial, night, dot-matrix and atlas styles.",
};

export default function AtlasPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-[#0b1412] text-atlas-paper">
          <div className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(232,184,106,.22),transparent)]" aria-hidden />
          <div className="pointer-events-none absolute -bottom-52 left-10 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(93,255,168,.12),transparent)]" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
            <p className="eyebrow text-atlas-ochre">The gallery</p>
            <h1 className="display mt-4 max-w-4xl text-5xl font-medium leading-[0.98] tracking-tight sm:text-7xl">
              Every one of these took <em className="font-normal text-atlas-ochre">one sentence.</em>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-atlas-paper/70">
              Each map is drawn live in your browser by the engine that will draw yours, from the sentence printed under it.
              Numbers are illustrative; the looks are real.
            </p>
          </div>
        </section>
        <section className="bg-atlas-card py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <AtlasGallery />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
