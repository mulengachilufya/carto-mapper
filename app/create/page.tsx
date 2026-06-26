import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { CreateWizard } from "@/components/create/CreateWizard";

export const metadata = { title: "Create a map — CartoMapper" };

export default function CreatePage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 lg:py-14">
        <CreateWizard />
      </main>
      <Footer />
    </>
  );
}
