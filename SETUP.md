# CartoMapper — setup guide (Netlify + Firebase)

Take the build from code → running → live. **Good news:** the app runs and generates maps
with **no backend at all** — so you can deploy to Netlify first and add Firebase later.

---

## 1. Run it locally (no keys needed)

```powershell
cd "C:\Users\Mapalo L. Moonze\Documents\carto-mapper-repo"
npm run dev
```

Open http://localhost:3000. The whole create flow + map preview + **SVG download** work
with zero keys (the map spec uses the built-in cartographic rules engine).

> Node may not be on your terminal PATH until you restart it. If `npm` isn't found, it's at
> `C:\Program Files\nodejs`.

---

## 2. Accounts you'll use

| Service | Why | Needed to launch? |
|---|---|---|
| [Netlify](https://netlify.com) | hosting | **Yes** |
| [Stripe](https://dashboard.stripe.com) | the $5 charge | Yes, to take payment (test mode is free) |
| [Anthropic](https://console.anthropic.com) | AI‑tailored map specs | Optional (rules engine works without it) |
| [Firebase](https://console.firebase.google.com) | save jobs / re‑downloads | **Later** — not required for launch |

---

## 3. Deploy to Netlify

1. Push this repo to GitHub (done — `mulengachilufya/carto-mapper`).
2. Netlify → **Add new site → Import an existing project** → pick the repo.
3. Netlify auto‑detects Next.js. Build command `npm run build` (already in `netlify.toml`).
4. **Site configuration → Environment variables** — add what you have:
   - `NEXT_PUBLIC_APP_URL` = your Netlify URL (e.g. `https://cartomapper.netlify.app`)
   - `ANTHROPIC_API_KEY` *(optional)*
   - `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` *(for payments)*
5. **Deploy.**

> **Next.js 16 note:** this app uses Next 16. If Netlify's Next runtime complains, pin the
> runtime or uncomment the `@netlify/plugin-nextjs` plugin in `netlify.toml`.

---

## 4. Stripe (the $5 payment)

1. Stripe → Developers → API keys → copy **test** secret + publishable keys into Netlify env.
2. Stripe → Developers → **Webhooks** → add endpoint
   `https://YOUR-SITE.netlify.app/api/stripe/webhook`, event `checkout.session.completed`,
   and copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

---

## 5. PDF export — done (client-side)

PDF export runs **in the browser** (`jsPDF` + `svg2pdf.js`): the map is already a clean SVG,
so the PDF is built client‑side — no server, no headless Chrome. Works on Netlify (and any
host) out of the box. (An SVG download is also available in the preview.)

---

## 6. Firebase (later — for saving jobs & re‑downloads)

The app does **not** need a database to sell a map (the buyer downloads right after paying).
Firebase adds: persisting each job, and letting buyers re‑download later.

When you're ready, create a Firebase project (Firestore + Storage) and **ask me to wire it** —
it's a small, self‑contained change (swap the optional Supabase adapter in `lib/` and the
best‑effort writes in the API routes for Firestore). I'll add the `firebase-admin` env vars
to `.env.local.example` at that point.

---

## What's pending (needs you, or a quick task for me)
- **You:** create Netlify + Stripe (+ later Firebase) accounts and add the env vars above.
- **Me, on your go:** wire Firebase (Firestore + Storage) for saving jobs / re‑downloads.
- Deferred: sub‑national (province/district) boundaries — only country‑level geodata is bundled.

See `PROGRESS.md` for the full build status.
