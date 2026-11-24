# ZYNTRIXLY 10 — "OBSIDIAN" RELEASE PLAN

**Version:** 10.0.0 · **Codename:** Obsidian · **Date:** 2026-11-24
**Design doctrine:** tasteskill (anti-slop) — one system, quiet panels, color spent on meaning, no template gradients, motion with intent.

---

## 1. Why V10

Zyntrixly evolved through four design generations (HIG migration → Apex → Apple-grade → Quality of Life).
Each was competent, but the product still *looked like a theme*: generic zinc-dark + system-blue that any
shadcn starter ships. V10 gives Zyntrixly its own recognizable instrument panel — the visual equivalent of
what the cryptography already is: precise, cold, and quietly confident.

## 2. Design Vision — "Obsidian Console"

| Layer | V4 (today) | V10 (Obsidian) |
|---|---|---|
| Ground | Flat `#09090b` zinc | Deep-space ink `#04060B` + aurora field (teal/indigo glows) + film grain |
| Accent | iOS system blue everywhere | **Vault Teal** `#2DD4BF` for security/active states only; **Emerald** `#10B981→#059669` reserved for *my* voice (bubbles, send, toggles) |
| Typography | Inter only | Inter for human text + **JetBrains Mono for machine truth** (security badges, version chips, timestamps of record) |
| Depth | Single-layer shadows | Layered ink shadows + tinted glows + specular rims + gradient hairlines |
| Radii | 10–16px | Concentric 12→20→24px hierarchy, pill system retained |
| Motion | Functional fades | Choreographed entrances (staggered auth rise, startup lockup reveal, bubble pop-in, pill springs) |
| Brand | Text-only lockup | Startup gets V10 chip + halo ring; gradient brand wordmark used in 3 places max |

Non-negotiables (tasteskill house rules): every state renders at 1440/768/390; hover lifts are 1–2px, never
tilt; no emoji-as-icons; no purple; captions under no visual; one accent family, spent on meaning.

## 3. Scope of Change

**Full rewrite (design system):** `src/styles/tokens.css`, `auth.css`, `layout.css`, `chat.css`, `modals.css`.
**Surgical edits:** `index.html` (title/meta, V10 startup chip, About version string, aurora canvas tint),
`package.json` → 10.0.0, `manifest.webmanifest` colors, `sw.js` cache `v10`, `README.md` What's New.
**Untouched by contract:** `app.js`, `crypto.js`, `webrtc.js`, `security.js`, `src/**/*.js` — zero logic risk.
**Hard constraint:** all 146 baseline DOM IDs preserved (`tests/dom_integrity.test.js` stays green).

## 4. V10 Pillars & Features

1. **Obsidian design system** — new tokens, aurora ambience, mono-for-machine typography, concentric radii, tinted focus rings.
2. **Choreographed entrances** — startup lockup sequence (halo → wordmark → V10 chip → decrypt dots), staggered auth card rise, bubble pop physics.
3. **Voice-coded palette** — emerald = "you", graphite = "them", teal = "secure/active", red = live/destructive. Meaning, never decoration.
4. **Instrument details** — tabular numerals in timers, mono security chips, gradient hairlines on every floating surface, refined 5px scrollbars.
5. **Version sovereignty** — V10 branding across PWA manifest, service-worker cache, About view, startup chip, README.

## 5. Quality Gates

- `node --test tests/dom_integrity.test.js` — 146 IDs + form security assertions.
- `node --check app.js` (untouched) + CSS class contract: every class referenced by `app.js`
  (`.msg-row`, `.mine`, `.conv-item`, `.m-tab`, `.open/.show/.active`, `.mob-chat-open`, …) survives.
- Local serve + multi-viewport visual inspection before push.

## 6. Delivery

Push → GitHub `main` (authenticated). Vercel delivery: repo is deploy-ready static (zero-config);
Git-connected Vercel projects pick the push up automatically, otherwise one-click import at
`vercel.com/new` — build none, output root `/`.
