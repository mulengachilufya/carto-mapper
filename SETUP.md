# CartoMapper — setup guide

CartoMapper is **free**. People sign up (like Lenga Maps: name, country, what they do,
email, password) and can make **up to 10 new maps in any 24 hours**. Changing a map and
downloading it again never count. There is no payment, premium tier or watermark.

---

## 1. Run it locally (no keys needed)

```powershell
cd "C:\Users\Mapalo L. Moonze\Documents\carto-mapper-repo"
npm run dev
```

Open http://localhost:3000. Without Supabase keys the site runs **open**: no sign-in, no
saving, no daily limit, and the map designer uses the built-in rules engine unless
`ANTHROPIC_API_KEY` is set. Add the keys below to try accounts locally (`.env.local`).

---

## 2. Services

| Service | Why | Needed to launch? |
|---|---|---|
| [Netlify](https://netlify.com) | hosting | **Yes** |
| [Supabase](https://supabase.com) | accounts, saved maps, the daily limit | **Yes** — a **new** project for CartoMapper, not the Lenga Maps one |
| [Anthropic](https://console.anthropic.com) | the AI cartographer | Recommended (the rules engine works without it) |
| [Resend](https://resend.com) | the welcome email | Recommended (sign-up works without it) |

---

## 3. Supabase (accounts + the 10-maps-a-day limit)

1. Create a new Supabase project for CartoMapper.
2. **SQL editor** → paste and run `supabase/schema.sql`. It creates `profiles` (filled from
   the sign-up form by a trigger) and `map_jobs` (each saved map, owned by a user), with
   row-level security on and no public policies — only the server touches them. Safe to
   re-run; it also upgrades a database from the old paid version.
3. **Authentication → Sign In / Providers → Email**: enabled, and **Confirm email off**.
   People are signed in the moment they register and go straight to the map maker.
4. **Authentication → URL Configuration**:
   - *Site URL*: `https://cartomapper.online`
   - *Redirect URLs*: add `https://cartomapper.online/auth/callback`
     (and `http://localhost:3000/auth/callback` for local testing). Deploy previews:
     `https://*--cartomapper.netlify.app/auth/callback`.
5. Supabase's built-in mailer then only sends password-reset emails; its few-per-hour
   limit is fine for that. No custom SMTP needed.
6. **Project Settings → API**: copy the URL, the `anon` key and the `service_role` key
   into the environment variables below.

**Welcome email** (`lib/email.ts`): every new account gets one welcome email, sent by
the site through [Resend](https://resend.com) (the same service Lenga Maps uses). In
Resend: **Domains → Add domain** → `cartomapper.online`, add the DNS records it shows,
then **API Keys → Create** and set `RESEND_API_KEY` in Netlify. The sender defaults to
`CartoMapper <hello@cartomapper.online>` (override with `RESEND_FROM`). Without the key,
sign-up still works; the welcome email is just skipped.

**How the limit works** (`lib/quota.ts`, `app/api/generate-spec/route.ts`): every new map
is a row in `map_jobs`; before the map designer runs, the server counts the user's rows from
the last 24 hours and refuses the 11th with a friendly message saying when the next slot
frees up. Changes to a map update its row (up to 20 per map) and don't count; removing a
map from "My maps" is a soft delete, so it still counts. Sign-in is checked on the server
with Supabase Auth on every request — the limit can't be bypassed from the browser.

---

## 4. Deploy to Netlify

1. Netlify → **Add new site → Import an existing project** → `mulengachilufya/carto-mapper`.
2. Build command `npm run build` (already in `netlify.toml`).
3. **Site configuration → Environment variables**:
   - `NEXT_PUBLIC_APP_URL` = your live URL
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
     — all three switch accounts on; with any missing the site runs open
   - `ANTHROPIC_API_KEY` *(recommended)*
   - `RESEND_API_KEY` *(for the welcome email)*
4. **Deploy.** Old `STRIPE_*` variables can be deleted.

---

## 5. PDF export (client-side)

PDFs are built **in the browser** (`jsPDF` + `svg2pdf.js`) from the map's SVG, terrain
included — no server rendering. An SVG download is offered alongside for designers.
