# CartoMapper — build progress

> Legend: ✅ done · 🔑 done but needs your keys/accounts to go live · ⏳ todo / deferred

## Status: MVP complete and verified ✅

The full pipeline is built and was tested end-to-end on this machine:
- `npm run build` — clean (TypeScript + lint pass, all routes compiled)
- Server boots, landing + `/create` + `/download` serve
- `POST /api/generate-spec` returns correct map specs (rules engine; Claude when keyed)
- `POST /api/generate-pdf` produced a real **1.1 MB PDF** (see `sample-map.pdf`) — the full
  server-render → Puppeteer → PDF path works, and **local Chrome works** for dev exports.

What's left is entirely **your accounts/keys** and **deploy** — no code blocked.

### Refinement pass (post-MVP polish)
Cartographic + quality refinements, each verified by rebuild + real PDF output:
- **Antarctica dropped** on world maps (it has no data and dominates an Equal-Earth page)
- **"No data" handling** — flat light-grey fill + a "No data" legend key for unmatched regions
  (replaced a hatch pattern that was noisy and bloated the PDF)
- **Proportional symbols** guard against negative values (size by magnitude)
- **Smarter titles** — meaningful sample column names per industry, and a fallback so a column
  literally named "value" doesn't produce "Value by Country"
- **Title wrapping** so long titles never overflow the page
- **Data-coverage note** in the preview ("matched N of M place names") so a name mismatch never
  looks like a broken/blank map
- Branded **favicon**, social/**OpenGraph** metadata, and a **lint-clean** codebase

## Phases

### Phase 0 — Setup ✅
Repo connected · Node 24 · Next scaffold · all dependencies · `.env.local.example` · `supabase/schema.sql`

### Phase 1 — Domain model ✅
24 industries × 5 questions (`lib/industries.ts`) · `MapSpec` Zod schema · session id · guarded Supabase clients

### Phase 2 — Cartographic engine ✅ ⭐
Equal-area projection chooser · ColorBrewer palettes · quantile/equal-interval/Jenks classification ·
scale bar · number formatting · Natural Earth geodata + loaders · `CartoMap` renderer (choropleth /
proportional-symbol / dot / point / categorical) with graticule, neatline, legend, north arrow, source.

### Phase 3 — Flow UI ✅
Landing page with **live example maps** · create wizard (industry + vibe → questions → data → preview) ·
CSV/Excel upload, paste, generate-sample, editable column mapping · furniture toggles · page size/orientation ·
revision box · SVG export.

### Phase 4 — Map intelligence ✅ 🔑
`/api/generate-spec` calls Claude (`claude-sonnet-4-6`) when `ANTHROPIC_API_KEY` is set, else the
deterministic rules engine. Keyword-based revision fallback. *(Works now via the rules engine; add the
key for AI-tailored specs.)*

### Phase 5 — Pay · PDF · Download ✅ 🔑
Stripe Checkout ($5) + webhook (🔑 needs Stripe keys) · Puppeteer 300 DPI PDF export (✅ verified) ·
Supabase persistence (🔑 best-effort, skipped without keys) · download page.

### Phase 6 — Deploy 🔑 ⏳
New Vercel project + env vars — see [SETUP.md](SETUP.md). I'll do the push + import when you say go.

## Deferred (sensible MVP boundaries, documented)
- **Sub-national boundaries** (province/district choropleths): only country-level geodata is bundled.
  Point maps inside any country already work. See `public/geodata`.
- **Credit packs** (3/5-map) purchase flow — pricing is shown; checkout is single-map for now.
- **Email delivery** of the download link.
- **Visual QA in a real browser** — couldn't run here (the preview tool is locked to this session's
  empty root folder, and the app lives in the sibling `carto-mapper-repo`). Build + a real PDF stand in.

## Decisions made (review these)
- **AI:** Claude (`claude-sonnet-4-6`) per your call, with a deterministic fallback so nothing breaks mid-sale.
- **Payments:** Stripe **Checkout** (hosted) — lowest maintenance, best conversion, PCI handled by Stripe.
- **Geodata:** Natural Earth **countries** (50m + 110m). World/continent/country maps look great today.
- **No auth:** anonymous `session_id`, per your spec.
- **Not committed to git yet** — say the word and I'll commit + push.
