import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { DownloadPanel } from "@/components/download/DownloadPanel";

export const metadata = { title: "Your map — CartoMapper" };

export default function DownloadPage() {
  return (
    <>
      <Header />
      <main className="atlas-grain flex flex-1 items-center bg-atlas-paper">
        <div className="mx-auto w-full max-w-2xl px-5 py-16">
          <DownloadPanel />
        </div>
      </main>
      <Footer />
    </>
  );
}
