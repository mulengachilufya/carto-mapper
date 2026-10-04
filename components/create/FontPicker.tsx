"use client";

import { useEffect, useState } from "react";

/** Map fonts people ask for, by feel. Any other Google Font can be typed in. */
export const MAP_FONTS: { name: string; note: string }[] = [
  { name: "Carlito", note: "Like Calibri" },
  { name: "Arimo", note: "Like Arial" },
  { name: "Tinos", note: "Like Times" },
  { name: "Lato", note: "Friendly sans" },
  { name: "Open Sans", note: "Neutral sans" },
  { name: "Roboto", note: "Modern sans" },
  { name: "Montserrat", note: "Geometric" },
  { name: "Source Sans 3", note: "Report sans" },
  { name: "Poppins", note: "Rounded geometric" },
  { name: "Oswald", note: "Condensed, bold" },
  { name: "Merriweather", note: "Sturdy serif" },
  { name: "Playfair Display", note: "Elegant serif" },
  { name: "Libre Baskerville", note: "Classic serif" },
  { name: "EB Garamond", note: "Book serif" },
];

const VALID = /^[A-Za-z0-9][A-Za-z0-9 ]{1,40}$/;

/** Load every listed font once, so the options show in their own typeface. */
function usePreviewFonts() {
  useEffect(() => {
    if (document.getElementById("cm-font-picker")) return;
    const link = document.createElement("link");
    link.id = "cm-font-picker";
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${MAP_FONTS.map((f) => `family=${f.name.replace(/ /g, "+")}`).join("&")}&display=swap`;
    document.head.appendChild(link);
  }, []);
}

function OneFont({ label, value, onChange }: { label: string; value: string; onChange: (f: string) => void }) {
  const listed = MAP_FONTS.some((f) => f.name === value);
  const [custom, setCustom] = useState(listed ? "" : value);
  const [other, setOther] = useState(!listed);
  return (
    <div>
      <span className="text-sm font-medium text-ink">{label}</span>
      <select
        value={other ? "__other" : value}
        onChange={(e) => {
          if (e.target.value === "__other") {
            setOther(true);
            if (VALID.test(custom)) onChange(custom);
          } else {
            setOther(false);
            onChange(e.target.value);
          }
        }}
        className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[15px] outline-none focus:border-accent"
        style={{ fontFamily: `'${listed ? value : "Carlito"}', Arial, sans-serif` }}
      >
        {MAP_FONTS.map((f) => (
          <option key={f.name} value={f.name} style={{ fontFamily: `'${f.name}'` }}>
            {f.name} · {f.note}
          </option>
        ))}
        <option value="__other">Another Google Font…</option>
      </select>
      {other ? (
        <input
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            if (VALID.test(e.target.value.trim())) onChange(e.target.value.trim());
          }}
          placeholder="Type any Google Font name, e.g. Nunito"
          className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
      ) : null}
    </div>
  );
}

/** Title font and text font, picked separately. */
export function FontPicker({
  title,
  text,
  onChange,
  stacked,
}: {
  title: string;
  text: string;
  onChange: (fonts: { title: string; text: string }) => void;
  /** One above the other, for narrow side panels. */
  stacked?: boolean;
}) {
  usePreviewFonts();
  return (
    <div className={stacked ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
      <OneFont label="Title font" value={title} onChange={(f) => onChange({ title: f, text })} />
      <OneFont label="Text font" value={text} onChange={(f) => onChange({ title, text: f })} />
    </div>
  );
}
