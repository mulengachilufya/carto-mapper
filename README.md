# CartoMapper

Generate **publication-quality, print-ready cartographic maps** (300 DPI PDF) from your
data in about a minute — for $5 a map. The whole point: every output looks like a
professional human cartographer made it, not AI clip-art.

> New here? Read **[SETUP.md](SETUP.md)** to run it and go live, and **[PROGRESS.md](PROGRESS.md)**
> for exactly what's built.

## Quick start

```powershell
cd "C:\Users\Mapalo L. Moonze\Documents\carto-mapper-repo"
npm run dev
```

Open http://localhost:3000. The create flow and map preview work with **no keys** (the map
spec uses the built-in cartographic rules engine). Payment, saving, and AI-tailored specs
need keys — see [SETUP.md](SETUP.md).

`sample-map.pdf` in this folder is a real export from the engine — open it to see the output.

## What it does

Pick an industry → answer 5 quick questions (+ optional plain-English "vibe") → upload a
CSV/Excel, paste a table, or generate a sample → preview a live map → tweak the furniture →
pay $5 → download a 300 DPI PDF.

## Tech

- **Next.js 15 / 16** (App Router, TypeScript) + **Tailwind v4**
- **D3** (`d3-geo`, `d3-scale`, `d3-scale-chromatic`) + **TopoJSON** + Natural Earth geodata
- **Map intelligence:** Anthropic **Claude** (`claude-sonnet-4-6`) with a deterministic
  cartographic **rules-engine fallback** (works with no key)
- **Firebase** (Firestore + Storage) — optional persistence (planned); the app runs without any database
- **Stripe** Checkout ($5 one-time)
- **PDF export:** headless-Chrome (Puppeteer) today; moving to client-side `jsPDF` + `svg2pdf` for Netlify
- **Netlify** for hosting

## The cartography (why it looks right)

`lib/cartography/` is a deliberate design system, not ad-hoc styling:

- **Equal-area projections** fitted to the region (`projection.ts`) — never Web Mercator for thematic maps
- **ColorBrewer palettes only** (`palettes.ts`) — sequential / diverging / qualitative, muted
- **Honest classification** (`classify.ts`) — quantile, equal-interval, or Jenks (ckmeans)
- **Real map furniture** (`scalebar.ts`, `CartoMap.tsx`) — km scale bar, discreet north arrow,
  graticule, neatline, hierarchical legend, source line — with conventions applied
  (e.g. world maps drop the scale bar and north arrow)

The renderer (`components/cartography/CartoMap.tsx`) uses D3 for the math and React for the
SVG, so the same component renders in the browser preview and server-side for the PDF.

## Project layout

```
app/                     routes (landing, /create, /download) + API routes
  api/generate-spec      industry+data → MapSpec (Claude or rules engine)
  api/generate-pdf       server-render the map → Puppeteer → PDF
  api/stripe/*           checkout + webhook
components/
  cartography/CartoMap   the map renderer (D3 math + React SVG)
  create/                the guided wizard (industry → questions → data → preview)
  marketing/             live example maps on the landing page
lib/
  cartography/           projections, palettes, classification, scale bar, geo loaders
  mapspec/               MapSpec schema (Zod), rules engine, Claude integration
  data/                  CSV/Excel/paste parsing, column inference, sample generation
  industries.ts          24 industries × 5 controlled questions
public/geodata/          Natural Earth countries (TopoJSON)
supabase/schema.sql      database + storage bucket
```
