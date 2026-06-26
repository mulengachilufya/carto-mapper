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
 * No server, no headless Chrome — works on any host. The map is clean vector SVG, so
 * the result stays crisp at print resolution.
 */
export async function exportSvgToPdf(svg: SVGSVGElement, page: MapSpec["page"], filename: string): Promise<void> {
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
