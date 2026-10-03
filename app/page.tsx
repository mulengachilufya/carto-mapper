import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Hero } from "@/components/home/Hero";
import { AtlasTeaser } from "@/components/home/AtlasTeaser";
import { Free } from "@/components/home/Free";

/** Short on purpose: the button first, then proof (real plates), then the offer. */
export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <AtlasTeaser />
        <Free />
      </main>
      <Footer />
    </>
  );
}
