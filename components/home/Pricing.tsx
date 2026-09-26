import { PricingCards } from "@/components/marketing/PricingCards";
import { SectionHeading } from "./SectionHeading";

const FREE = ["Unlimited previews", "Every style and page size", "Place names, relief, rivers", "One revision per map"];

export function Pricing() {
  return (
    <section id="pricing" className="atlas-grain bg-atlas-paper py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Pricing"
          align="center"
          title={
            <>
              Preview free. <em className="font-normal text-atlas-ocean">Pay for the one you print.</em>
            </>
          }
          sub="A professional cartographer charges hundreds for a map like this, and takes weeks. Here it is five dollars and a few minutes."
        />
        <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-atlas-ink-2">
          {FREE.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span className="text-atlas-green">✓</span> {f}
            </li>
          ))}
        </ul>
        <div className="mx-auto mt-14 max-w-5xl">
          <PricingCards />
        </div>
        <p className="mt-8 text-center text-sm text-atlas-ink-2/80">No subscription, no account. Extra revisions $5 each.</p>
      </div>
    </section>
  );
}
