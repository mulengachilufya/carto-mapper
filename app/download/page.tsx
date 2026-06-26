import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { DownloadPanel } from "@/components/download/DownloadPanel";

export const metadata = { title: "Your map — CartoMapper" };

export default function DownloadPage() {
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-2xl flex-1 items-center px-5 py-16">
        <div className="w-full">
          <DownloadPanel />
        </div>
      </main>
      <Footer />
    </>
  );
}
