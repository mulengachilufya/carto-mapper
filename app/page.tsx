import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Hero } from "@/components/home/Hero";
import { ScaleJourney } from "@/components/home/ScaleJourney";
import { Styles } from "@/components/home/Styles";
import { Audiences } from "@/components/home/Audiences";
import { HowItWorks } from "@/components/home/HowItWorks";
import { AtlasTeaser } from "@/components/home/AtlasTeaser";
import { Free } from "@/components/home/Free";
import { Faq } from "@/components/home/Faq";
import { FinalCta } from "@/components/home/FinalCta";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <ScaleJourney />
        <Styles />
        <HowItWorks />
        <Audiences />
        <AtlasTeaser />
        <Free />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
