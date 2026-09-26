/**
 * Open-redirect guard for the `next` parameter in the sign-in flow. Only a
 * same-origin path is allowed; anything that could leave the site (`https://…`,
 * `//evil.com`, `/\evil.com`, control characters) falls back to `fallback`.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/create"): string {
  if (!raw || typeof raw !== "string") return fallback;
  if (raw[0] !== "/" || raw[1] === "/" || raw.includes("\\")) return fallback;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return fallback;
  }
  return raw;
}
