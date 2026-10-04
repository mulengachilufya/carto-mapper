<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes: APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# House style (owner's standing rules: never break these)

- **No em dashes (U+2014) or en dashes (U+2013) anywhere** a person can read: page copy, titles, labels, legends, emails, map text, AI output. Use commas, colons, full stops or "to" for ranges. `noDash()` in `lib/engine/index.ts` strips them from every map spec; the AI prompt forbids them too.
- **No monospace fonts.** No JetBrains Mono, no `font-mono`, no spaced-out uppercase "eyebrow" labels. Labels use the sans (Inter) in sentence case.
- **No beige, cream or brownish-grey backgrounds.** Pages are white (`--paper`) with cool, faintly green greys (`--atlas-card`, `--line`); dark sections use the pine/night greens. The brand accents stay: forest green `#1f5c4d`, leather red `#8b2e26`, ochre `#c68a3a`. Water on maps stays blue.
- **Maps for data never show rivers or terrain** unless someone asks for a physical/terrain map. Default look is Editorial; Night and Dots are the alternatives.
- The brand is global: examples and copy should not default to Africa or any one region.
