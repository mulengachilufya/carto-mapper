import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 ]{1,40}$/;

/**
 * A Google Font as TrueType, for embedding in PDFs (jsPDF reads TTF, not WOFF2).
 * Google serves TTF to non-browser clients, so we ask on the user's behalf.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const family = url.searchParams.get("family") ?? "";
  const weight = url.searchParams.get("weight") === "700" ? "700" : "400";
  if (!FAMILY.test(family)) return NextResponse.json({ error: "bad family" }, { status: 400 });
  const q = encodeURIComponent(family).replace(/%20/g, "+");
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${q}:wght@${weight}`, { headers: { "User-Agent": "curl/8.0" } });
    if (!css.ok) return NextResponse.json({ error: "unknown font" }, { status: 404 });
    const src = (await css.text()).match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/)?.[1];
    if (!src) return NextResponse.json({ error: "no ttf" }, { status: 404 });
    const ttf = await fetch(src);
    if (!ttf.ok) return NextResponse.json({ error: "fetch failed" }, { status: 502 });
    return new NextResponse(await ttf.arrayBuffer(), {
      headers: { "Content-Type": "font/ttf", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
