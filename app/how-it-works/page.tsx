import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ScaleJourney } from "@/components/home/ScaleJourney";
import { Styles } from "@/components/home/Styles";
import { Audiences } from "@/components/home/Audiences";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Faq } from "@/components/home/Faq";
import { FinalCta } from "@/components/home/FinalCta";

export const metadata = { title: "How it works — CartoMapper" };

/** The longer story: how the engine works, the styles, who it's for, questions. */
export default function HowItWorksPage() {
  return (
    <>
      <Header />
      <main>
        <HowItWorks />
        <ScaleJourney />
        <Styles />
        <Audiences />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
