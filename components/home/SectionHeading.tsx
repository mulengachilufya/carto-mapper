import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  sub,
  tone = "light",
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  tone?: "light" | "dark";
  align?: "left" | "center";
}) {
  const dark = tone === "dark";
  return (
    <div className={`max-w-3xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      <p className={`eyebrow ${dark ? "text-atlas-ochre" : "text-atlas-ocean"}`}>{eyebrow}</p>
      <h2 className={`display mt-3 text-4xl font-semibold leading-[1.05] sm:text-5xl ${dark ? "text-atlas-paper" : "text-atlas-ink"}`}>
        {title}
      </h2>
      {sub && <p className={`mt-5 text-lg leading-relaxed ${dark ? "text-atlas-paper/75" : "text-atlas-ink-2"}`}>{sub}</p>}
    </div>
  );
}
