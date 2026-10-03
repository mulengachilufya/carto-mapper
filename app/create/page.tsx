import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { CreateWizard } from "@/components/create/CreateWizard";

export const metadata = { title: "Create a map — CartoMapper" };

export default function CreatePage() {
  return (
    <>
      <Header />
      <main className="atlas-grain flex-1 bg-atlas-paper">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 lg:px-8 lg:py-14">
          <CreateWizard />
        </div>
      </main>
      <Footer />
    </>
  );
}
