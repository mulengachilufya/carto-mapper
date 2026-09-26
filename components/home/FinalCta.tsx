import Image from "next/image";
import Link from "next/link";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-atlas-night py-28 text-center text-atlas-paper lg:py-40">
      <Image src="/media/earth-dark.jpg" alt="" fill sizes="100vw" className="object-cover object-center opacity-80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(8,20,33,0.75)_70%)]" />
      <div className="relative mx-auto max-w-3xl px-5">
        <p className="eyebrow text-atlas-ochre">Your turn</p>
        <h2 className="display mt-4 text-5xl font-semibold leading-[1.02] sm:text-7xl">
          Put your world <em className="font-normal text-atlas-sea">on the map.</em>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-atlas-paper/75">Three minutes from now you could be holding it.</p>
        <Link
          href="/create"
          className="mt-10 inline-flex h-14 items-center rounded-full bg-atlas-ochre px-10 text-lg font-semibold text-atlas-night transition-colors hover:bg-[#d89c4b]"
        >
          Make my map
        </Link>
      </div>
    </section>
  );
}
