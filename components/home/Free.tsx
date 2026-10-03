import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { DAILY_MAP_LIMIT } from "@/lib/quota-rules";

const INCLUDED = [
  ["Every style", "Atlas relief, classic political, minimal ink"],
  ["Every geography", "World, continents, countries, provinces, districts, points"],
  ["Print-ready files", "Vector PDF at A4 or Letter, SVG for designers — no watermark"],
  ["The AI cartographer", "Reads your data and reports, explains every design decision"],
  ["Changes in plain words", "“Make it green”, “use natural breaks”, “drop the north arrow”"],
  ["Your maps, kept", "Saved to your account — open and download again any time"],
];

export function Free() {
  return (
    <section id="free" className="atlas-grain bg-atlas-paper py-24 lg:py-32">
      <div className="mx-auto grid max-w-7xl items-start gap-14 px-5 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div>
          <SectionHeading
            eyebrow="Free"
            title={
              <>
                Free for everyone. <em className="font-normal text-atlas-leather">No premium, no catch.</em>
              </>
            }
            sub="Maps should be for everyone who needs one — the district health officer, the geography teacher, the student with a thesis due. Make a free account and you have the whole studio."
          />
          <dl className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {INCLUDED.map(([k, v]) => (
              <div key={k} className="border-t border-atlas-rule pt-4">
                <dt className="font-medium text-atlas-ink">{k}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-atlas-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="plate lg:mt-6">
          <div className="p-8">
            <p className="eyebrow text-atlas-leather">The only limit</p>
            <p className="display mt-3 text-6xl font-semibold text-atlas-ink">
              {DAILY_MAP_LIMIT}
              <span className="ml-2 text-2xl font-normal text-atlas-ink-2">new maps a day</span>
            </p>
            <div className="mt-6 grid grid-cols-5 gap-2" aria-hidden>
              {Array.from({ length: DAILY_MAP_LIMIT }, (_, i) => (
                <span
                  key={i}
                  className="aspect-[1.414] rounded-sm border border-atlas-rule"
                  style={{
                    background: [
                      "linear-gradient(135deg,#a9c9a0,#e8d9a6 55%,#c79a6b)",
                      "linear-gradient(135deg,#bcd6ea,#f3d9b1 60%,#cfe0b4)",
                      "linear-gradient(135deg,#f5f1e8,#d9d3c4)",
                    ][i % 3],
                  }}
                />
              ))}
            </div>
            <p className="mt-6 leading-relaxed text-atlas-ink-2">
              Per person, over any 24 hours — plenty for a report&apos;s worth of maps. Changing a map and downloading it
              again never count. The limit simply keeps the engine fast and free for everyone.
            </p>
            <Link
              href="/signup"
              className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-full bg-atlas-forest text-[15px] font-semibold text-atlas-paper transition-colors hover:bg-atlas-moss"
            >
              Create your free account
            </Link>
            <p className="mt-3 text-center text-xs text-atlas-ink-2/80">Thirty seconds. No card, no trial.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
