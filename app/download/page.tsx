import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { DownloadPanel } from "@/components/download/DownloadPanel";

export const metadata = { title: "Your map — CartoMapper" };

export default function DownloadPage() {
  return (
    <>
      <Header />
      <main className="atlas-grain flex-1 bg-atlas-paper">
        <div className="mx-auto w-full max-w-5xl px-5 py-12 lg:px-8">
          <DownloadPanel />
        </div>
      </main>
      <Footer />
    </>
  );
}
