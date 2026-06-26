import { NextResponse } from "next/server";
import { createElement } from "react";
import { CartoMap } from "@/components/cartography/CartoMap";
import { loadCountriesServer } from "@/lib/cartography/geo.server";
import { parseMapSpec } from "@/lib/mapspec/schema";
import { getPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const spec = parseMapSpec(body.spec);
  const data = Array.isArray(body.data) ? (body.data as Record<string, unknown>[]) : [];

  try {
    const geo = await loadCountriesServer("50m");
    const landscape = spec.page.orientation === "landscape";
    const W = landscape ? 1400 : 990;
    const H = Math.round(landscape ? W / Math.SQRT2 : W * Math.SQRT2);

    const { renderToStaticMarkup } = await import("react-dom/server");
    const svg = renderToStaticMarkup(
      createElement(CartoMap, { spec, data: data as never, geo, width: W, height: H }),
    );
    const pdf = await getPdf(buildHtml(svg), spec.page);

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug(spec.title)}.pdf"`,
      },
    });
  } catch (err) {
    console.error("generate-pdf error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 },
    );
  }
}

function buildHtml(svg: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap" rel="stylesheet" />
<style>
  :root {
    --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
    --font-serif: 'Source Serif 4', Georgia, 'Times New Roman', serif;
  }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  svg { display: block; width: 100%; height: auto; }
</style>
</head>
<body>${svg}</body>
</html>`;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cartomapper-map";
}
