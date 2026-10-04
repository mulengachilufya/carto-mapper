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
export async function exportSvgToPdf(svg: SVGSVGElement, page: MapSpec["page"], filename: string): Promise<void> {
  await waitForRelief(svg);
  const doc = new jsPDF({
    orientation: page.orientation === "landscape" ? "landscape" : "portrait",
    unit: "pt",
    format: page.size === "Letter" ? "letter" : "a4",
  });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  await svg2pdf(svg, doc, { x: 0, y: 0, width: w, height: h });
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
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
