import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import type { MapSpec } from "@/lib/mapspec/schema";

/** Page size in PDF points (1/72"). */
export function pagePt(page: MapSpec["page"]): { w: number; h: number } {
  const [short, long] = page.size === "Letter" ? [612, 792] : [595.28, 841.89];
  return page.orientation === "landscape" ? { w: long, h: short } : { w: short, h: long };
}

/**
 * Render an on-page SVG into a vector PDF entirely in the browser (jsPDF + svg2pdf).
 * No server, no headless Chrome, works on any host. The map is clean vector SVG, so
 * the result stays crisp at print resolution.
 */
export async function exportSvgToPdf(svg: SVGSVGElement, page: MapSpec["page"], filename: string, fonts: string[] = []): Promise<void> {
  await waitForRelief(svg);
  const doc = new jsPDF({
    orientation: page.orientation === "landscape" ? "landscape" : "portrait",
    unit: "pt",
    format: page.size === "Letter" ? "letter" : "a4",
  });
  // Embed the map's own fonts; any that can't be fetched fall back to Helvetica.
  for (const fam of new Set(fonts.filter(Boolean))) {
    const ok = await embedFont(doc, fam);
    if (!ok) svg.querySelectorAll("[style*='font-family'], [font-family]").forEach((el) => {
      const e = el as SVGElement;
      if (e.style.fontFamily.replace(/['"]/g, "") === fam) e.style.fontFamily = "helvetica";
      if (e.getAttribute("font-family") === fam) e.setAttribute("font-family", "helvetica");
    });
  }
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  await svg2pdf(svg, doc, { x: 0, y: 0, width: w, height: h });
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

async function embedFont(doc: jsPDF, family: string): Promise<boolean> {
  try {
    let any = false;
    for (const [weight, style] of [["400", "normal"], ["700", "bold"]] as const) {
      const res = await fetch(`/api/font?family=${encodeURIComponent(family)}&weight=${weight}`);
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const file = `${family.replace(/\s+/g, "")}-${weight}.ttf`;
      doc.addFileToVFS(file, btoa(bin));
      doc.addFont(file, family, style);
      any = true;
    }
    return any;
  } catch {
    return false;
  }
}

/**
 * Atlas-style maps render their terrain asynchronously (data-relief="pending" until
 * done). Wait for it so the PDF includes the relief, but never hang the download:
 * after the timeout the PDF is exported with whatever has rendered.
 */
async function waitForRelief(svg: SVGSVGElement, timeoutMs = 20_000): Promise<void> {
  const start = Date.now();
  while (svg.getAttribute("data-relief") === "pending" && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 150));
  }
}
