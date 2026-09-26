/** Save an on-page SVG as a standalone .svg file. */
export function downloadSvgFile(svg: SVGSVGElement, title: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const str = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([str], { type: "image/svg+xml;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cartomapper-map"}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}
