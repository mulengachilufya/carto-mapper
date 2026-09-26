import { AtlasGallery } from "@/components/marketing/AtlasGallery";

export const metadata = { title: "The Atlas — CartoMapper" };

export default function AtlasPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">The Atlas</h1>
      <p className="mt-3 max-w-2xl text-muted">Specimen plates rendered live by the CartoMapper engine. Data is illustrative.</p>
      <div className="mt-10">
        <AtlasGallery />
      </div>
    </main>
  );
}
