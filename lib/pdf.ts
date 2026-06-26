import type { MapSpec } from "@/lib/mapspec/schema";

const MM: Record<MapSpec["page"]["size"], [number, number]> = {
  A4: [210, 297],
  Letter: [216, 279],
};

function pageDims(page: MapSpec["page"]): { width: string; height: string } {
  const [shortMm, longMm] = MM[page.size];
  const [w, h] = page.orientation === "landscape" ? [longMm, shortMm] : [shortMm, longMm];
  return { width: `${w}mm`, height: `${h}mm` };
}

/**
 * Render an HTML document to a single-page PDF. Uses @sparticuz/chromium on
 * Vercel/Lambda, and a locally-installed Chrome everywhere else. Because the map
 * is vector SVG, the PDF is resolution-independent (effectively 300 DPI+ in print).
 */
export async function getPdf(html: string, page: MapSpec["page"]): Promise<Buffer> {
  const onServerless = Boolean(process.env.VERCEL || process.env.AWS_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const puppeteer = await import("puppeteer-core");

  const browser = onServerless
    ? await launchServerless(puppeteer)
    : await puppeteer.launch({
        channel: process.env.PUPPETEER_EXECUTABLE_PATH ? undefined : "chrome",
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        headless: true,
      });

  try {
    const p = await browser.newPage();
    await p.setContent(html, { waitUntil: "load" });
    await p.evaluate(async () => {
      const d = document as unknown as { fonts?: { ready?: Promise<unknown> } };
      if (d.fonts?.ready) await d.fonts.ready;
    });
    const { width, height } = pageDims(page);
    const pdf = await p.pdf({ width, height, printBackground: true, pageRanges: "1" });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

async function launchServerless(puppeteer: typeof import("puppeteer-core")) {
  const chromium = (await import("@sparticuz/chromium")).default;
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}
