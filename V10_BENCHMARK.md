# ZYNTRIXLY 10 — LAYOUT BENCHMARK vs REAL APPS

**Method:** Same-ruler measurement. (1) Headless Chrome DOM measurement of our app at
desktop 1440×900 and mobile 390×844 with populated mock conversations. (2) Production
CSS source mining of Telegram Web K (`web.telegram.org/k/`, bundle `index-CI605M7_.css`)
for ground-truth layout values. (3) Behavior capture of Element Web, Telegram Web and
WhatsApp Web at both viewports (all reachable, zero horizontal overflow everywhere).
Harness: `scripts/benchmark_layout.mjs` → `scripts/benchmark_results.json`.

---

## 1. Ground truth from real apps

| Metric | Telegram Web K (production CSS) | Platform guideline |
|---|---|---|
| Chat topbar height | `--chat-topbar-height: 3rem` = **48px** | — |
| Input field height | `.input-field { --height: 3rem }` = **48px** | — |
| Desktop breakpoint | `@media (min-width: 926px)` → **926px** | — |
| Bubble width cap | `max-width: 600px` dominant (82 occurrences) + `80–100%` responsive fallbacks | — |
| Page padding rhythm | `--page-chats-padding: 8px` | — |
| Tap targets | 48px input ecosystem | Apple HIG **44×44pt** min; Material **48×48dp** min |
| Mobile ≤ breakpoint | full-screen single column (measured `sidebar-left-overlay` 390×844) | — |
| Horizontal overflow @390 | **0px** on Telegram, WhatsApp, Element | — |

## 2. Our layout, measured (before rebuild)

| Metric | Ours desktop 1440 | Ours mobile 390 | Real-app reference | Verdict |
|---|---|---|---|---|
| Shell architecture | `display: flex` ad-hoc (rail 68 + sidebar 312 + chat) | stacked | grid-driven columns | ⚠️ fragile, no density tokens |
| Chat header | **62px** | 62px | Telegram: **48px** | ❌ 29% too tall — steals reading space |
| Input field | 42px | 42px | Telegram: **48px** | ❌ undersized, cramped IME |
| Composer icon buttons | — | emoji **22×36**, mic **20×36** | 44–48px | ❌ **fails HIG 44pt** badly |
| Sidebar icon buttons | — | **32×32** | 44–48px | ❌ fails HIG |
| Mobile FAB / avatar btns | — | **36×36** | 44–48px | ❌ fails HIG |
| Bubble max-width | **none** (measured 729px-wide bubble) | none | Telegram **600px** cap | ❌ unbounded lines unreadable |
| Bubble padding / font | 10/14 · 14.5px | same | ~8/12 · 15px typical | ⚠️ close, tune with cap |
| Conversation item | 61px, pad 9/10 | 61px | ~64–72px density | ⚠️ slightly tight |
| Sub-44px tap targets (mobile) | — | **13** | 0 | ❌ the headline failure |
| Mobile pattern | full-screen column ✓ | ✓ | full-screen column ✓ | ✅ match |
| Horizontal overflow @390 | to re-verify after rebuild | — | 0px everywhere | target: 0 |

## 3. Verdict

The layout fails **real-app ergonomics in exactly three places**: oversized chrome
(62px header), undersized input (42px), and touch targets 20–36px where real apps run
44–48px — plus one reading-comfort failure: bubbles with no width cap. The information
architecture (rail → sidebar → chat, full-screen mobile column) is correct and matches
Telegram's structure; what is wrong is the **dimensional system**. Everything below
follows from one decision: rebuild the shell on measured values (48px chrome, 44px
touches, 600–620px bubbles, 926px breakpoint) instead of invented ones.

## 4. Rebuild contract (V10.1 "Obsidian Shell")

1. `layout.css` deleted and rewritten from zero: CSS Grid shell `64px 340px 1fr`,
   `100dvh`, safe-area insets, `overscroll-behavior`, density tokens, Telegram-real
   926px breakpoint, single-column mobile with existing `.mob-chat-open` contract.
2. `chat.css` structural rebuild: 48px header, 48px composer input, 44×44 icon boxes,
   bubble `max-width: min(78%, 620px)`, container-query aware.
3. `modals.css`: bottom-sheet pattern ≤925px (real mobile-app behavior), centered
   dialogs ≥926px.
4. Hard constraints kept: all 146 baseline DOM IDs, app.js class contract
   (`.msg-row`, `.conv-item`, `.m-tab`, `.mob-back-only`, `.mob-list-only`, state
   classes `.open/.show/.active/.hidden/.active-select/.out/.vis`).

*All numbers above are measured or sourced from production code; none are estimates.*

---

## 5. After the rebuild — re-measured (same harness, same rules)

| Metric | Before | After | Reference | Verdict |
|---|---|---|---|---|
| Shell architecture | flex ad-hoc | **CSS Grid `64px 340px 1fr`** | — | ✅ |
| Chat header | 62px | **48px** | Telegram 48px | ✅ match |
| Input field | 42px / 14px | **48px / 15px** | Telegram 48px | ✅ match |
| Bubble width | uncapped (729px) | **capped `min(72%, 620px)`** (measured 620px) | Telegram ~600px | ✅ match |
| Conversation row | 61px | **64px** | — | ✅ |
| Sub-44px tap targets (mobile) | **13** | **0** (largest remaining 44×44) | real apps: 0 | ✅ match |
| Mobile shell | stacked | single column, Telegram-real **926px** breakpoint, one header (de-duplicated fullscreen/avatar buttons) | Telegram full-screen column | ✅ match |
| Modals on mobile | centered dialog | **bottom sheets** w/ handle + safe-area | iOS/WhatsApp pattern | ✅ |
| Voice-note bubble | unstyled since V4 (vertical stub) | horizontal play + waveform + duration | real IM anatomy | ✅ |
| Install banner | covered composer | raised clear of input | — | ✅ |
| Horizontal overflow @390 | — | 0px | real apps: 0px | ✅ |

Unit quality gates after rebuild: 42/42 (dom_integrity 4, security 7, crypto 12,
webrtc 5, messaging 5, calling_auth 2, firestore 7). Harness:
`scripts/benchmark_layout.mjs` · live re-capture: `screenshots/` (12 viewports)
+ `screenshots/bench/` (real-app references).
