---
name: design-web-vitals
description: >-
  Performance module of design-arsenal: ship interfaces that pass Core Web Vitals.
  Covers the three p75 field metrics (LCP, INP, CLS) plus TTFB/FCP support metrics,
  the resource-priority playbook for hero content, layout-stability engineering,
  main-thread budgeting for input latency, image/font/JS loading strategy, third-party
  facades, and a performance-budget workflow. Use when the user says: performance,
  slow page, speed, lighthouse, core web vitals, web vitals, LCP, INP, CLS, perf
  budget, image optimization, font loading, render-blocking, lazy loading,
  'بطيء', 'أداء', 'سرعة', 'تحسين الأداء', 'تحميل بطيء', or when a Lighthouse/CrUX
  report shows failing metrics. Runs a zero-dependency static HTML linter that flags
  the most common vitals killers before you ever open a browser. Read fully first.
---

# design-web-vitals

Performance is a design property. A hero image that pops in late, a headline that
jumps because a font swapped, a page that ignores taps for 400 ms — users experience
all three as broken design, and search ranking systems agree. This module gives
you the thresholds that matter, the loading playbook for each metric, and a static
linter that catches the classic killers in raw HTML before anything is deployed.
It composes with the other modules: `taste`/`impeccable` decide what the page looks
like, `gsap`/`transitions` decide how it moves — this module decides how fast it
arrives and how stable it stays. Every animation shipped via the motion modules
must still run inside this module's main-thread budget.

One script ships with this module (zero dependencies, Node 18+):

```bash
node skills/web-vitals/scripts/webvitals.mjs page.html      # static vitals audit
node skills/web-vitals/scripts/webvitals.mjs src/ --json    # all HTML files, machine output
node skills/web-vitals/scripts/webvitals.mjs --self-test    # sanity check, exit 0/1
```

The linter is static: it reads markup and inline styles, not a running browser.
It catches *structural* causes (lazy-loaded heroes, dimensionless media,
render-blocking head scripts, `font-display` missing, `document.write`, inline
`onclick` hot paths). Runtime numbers come from the measurement stack in §8 —
never claim a metric value you did not measure.

## 1. The metrics and their thresholds — p75, not averages

| Metric | What it measures | Good | Poor | Failure feel |
|---|---|---|---|---|
| **LCP** | Time until the largest content element paints | **≤ 2.5 s** | > 4.0 s | "the page is empty" |
| **INP** | Worst interaction-to-next-paint latency (replaced FID Mar 2024) | **≤ 200 ms** | > 500 ms | "it ignores my taps" |
| **CLS** | Cumulative layout shift score | **≤ 0.1** | > 0.25 | "it moved as I clicked" |
| TTFB | First byte of the HTML document | ≤ 0.8 s | > 1.8 s | gates everything else |
| FCP | First content paint (any text/image) | ≤ 1.8 s | > 3.0 s | perceived start |

Rules of interpretation:

- Field data (CrUX, real users, 28-day p75) is the truth; Lighthouse is a lab
  *debugger*. A passing Lighthouse run does not mean passing field metrics.
- INP observes the *worst* meaningful interaction, not the first — one blocked
  click handler on a slow route can sink a page that "feels fast" in a demo.
- CLS is a score, not seconds: one full-viewport shift ≈ 1.0. The budget of 0.1
  allows roughly one small shift, not "a few jumps are fine".
- Fix in TTFB order: a slow server makes every later optimization invisible.

## 2. LCP — the resource-priority playbook

The LCP element is usually the hero image or the headline block. Four levers,
in the order they usually pay out:

1. **Never lazy-load the LCP candidate.** `loading="lazy"` on a hero `<img>` is
   the single most common self-inflicted LCP regression — the browser must finish
   layout before it even *discovers* the request. Hero: `loading="eager"` (the
   default — simply omit the attribute) + `fetchpriority="high"`. Below-fold
   images: `loading="lazy"` everywhere, that part is correct and helps.
2. **Let the browser discover it early.** If the URL is only known after CSS or
   JS runs (background-image in a stylesheet, client-rendered `<img>`), add
   `<link rel="preload" as="image" href="..." fetchpriority="high">` in the head.
   Preloading something the browser would have found first is a waste — audit
   with DevTools' LCP breakdown before adding one.
3. **Shrink and modernize the bytes.** Hero image ≤ ~100 KB compressed, AVIF or
   WebP (see §5), responsive `srcset`/`sizes` so a 390 px phone downloads the
   800 px file, not the 2400 px one.
4. **Get out of the resource's way.** Synchronous head scripts, fonts chained on
   CSS, and SSR-free client rendering each delay the paint (§6, §7). TTFB above
   0.8 s caps every other fix — cache HTML, use a CDN, trim redirects.

The client-rendered landing page (empty HTML → JS → data fetch → paint) is the
hardest LCP failure to patch; prefer server rendering or static generation for
anything above the fold.

## 3. CLS — reserve the space before the content arrives

Layout shift happens when paint is scheduled before geometry is known. The fix
is always the same: know the box before the content fills it.

- **Every `<img>` and `<iframe>` carries explicit `width` and `height`
  attributes** (or an `aspect-ratio` in CSS). This is the linter's highest-volume
  check for a reason — it is the most common CLS defect in generated markup.
- **Fonts swap without moving text**: pair `font-display: swap` with a fallback
  whose metrics match (`size-adjust`, `ascent-override`, `descent-override` in
  `@font-face`). `font-display: optional` is the zero-CLS alternative when the
  brand font is negotiable on first visit.
- **Dynamic content never pushes existing content down**: ads, embeds, banners,
  and late-loaded lists get reserved slots (min-height / fixed placeholder).
  Consent banners must overlay, not inject.
- **Skeletons over spinners**: a skeleton of the final geometry keeps the page
  stable; a centered spinner guarantees a shift when content lands.
- **Animate only `transform`/`opacity`** — `top`/`margin`/`height` animations
  both jank and shift (the `gsap-performance` module encodes the same rule).
- Infinite scroll / "load more" needs a guard: keep an interaction-safe gap of
  at least two viewports below the fold so new rows never land under a moving
  finger.

## 4. INP — keep the main thread ready to answer

INP measures responsiveness: from tap to next painted frame, at p75. The enemy
is the **long task** (any main-thread block > 50 ms).

- **Handlers stay under 50 ms** or yield: chunk work with
  `await scheduler.yield()` (or `setTimeout(0)` as the portable fallback)
  between batches; render the optimistic state *first*, sync the server after.
- **Batch DOM reads and writes.** Alternate `getBoundingClientRect` and style
  writes in one handler and you force synchronous layout every iteration —
  layout thrash is the classic 200 ms+ INP cause. Read everything, then write
  everything (the `gsap` batch patterns already do this).
- **Debounce expensive input work** (search-as-you-type, resize handlers) and
  keep keystroke handlers free of layout queries.
- **Virtualize long lists** (thousands of DOM nodes make every interaction
  expensive); paginate when virtualization is not available.
- **Break up hydration**: a huge framework bundle executing on load blocks every
  early interaction — code-split per route (§7) and defer hydration of
  below-fold components.
- Facade every embed: a click-to-load YouTube/chat facade removes seconds of
  third-party script from the critical path (§7).

## 5. Images — the biggest bytes on the page

- **Format ladder**: AVIF (best) → WebP → JPEG as last resort. Never ship PNG
  for photographic content, never ship BMP/TIFF at all. The static linter flags
  `.png` heroes for exactly this reason.
- **Responsive delivery**: `srcset` with width descriptors + `sizes` matching
  the actual layout width. Default `sizes=100vw` is usually wrong and wasteful.
- **Lazy-load below the fold only** (`loading="lazy"`); combine with
  `decoding="async"`. List images also get explicit dimensions (CLS §3).
- **Let the CDN resize** — one source file + URL params (`?w=800&format=avif`)
  beats six hand-exported variants that drift out of sync.
- **`<picture>` for art direction** (different crops per breakpoint), not for
  format switching — `srcset` already negotiates formats in modern browsers.
- LQIP/blur placeholders are a taste decision, but they still need the real
  image to arrive fast — they complement §2, they do not replace it.

## 6. Fonts and CSS — unblock the first paint

- **WOFF2 only, subset to the script(s) actually used.** Arabic + Latin sites:
  two subsets, not one merged file (see `rtl-arabic` for the Arabic loading
  order). A full CJK face can outweigh every other resource combined.
- **`font-display: swap` + metric-matched fallback** for brand fonts;
  `font-display: optional` when the first paint matters more than the typeface.
  The linter flags `@font-face` blocks missing `font-display` — every one of
  them risks both LCP (invisible text) and CLS (swap reflow).
- **Preload at most one or two critical font files** (the headline weight), with
  `crossorigin` — preload more and you compete with the LCP image.
- **`preconnect`** to `fonts.gstatic.com` (and your CDN origin) when external
  font origins are in play; the linter checks this pairing.
- **No `@import` chains** — they serialize CSS discovery. Bundle or `<link>`.
- **Critical CSS inline, the rest async** (`<link rel="stylesheet" media="print"
  onload="this.media='all'">` + `<noscript>` fallback) for pages with real
  above-fold content; with a bundler, route-level extraction does this better.

## 7. JavaScript — the budget nobody sees but everyone feels

- **Defer everything**: `<script src defer>` (or `type="module"`, which is
  implicitly deferred). A classic script in `<head>` without `defer`/`async`
  blocks parsing of everything below it — the linter's clearest LCP finding.
- **Route-level code splitting**; shared chunks stay under ~50 KB compressed.
  A landing page that needs interactivity in the footer should not ship the
  hero carousel's code on load.
- **Third-party cost is real**: each tag can cost 30–300 KB plus main-thread
  time (analytics, chat, A/B, pixel). Load them `defer`/`async`, after
  interaction or idle (`requestIdleCallback`), audit quarterly, and delete the
  ones nobody reads. A/B-test scripts belong server-side when possible.
- **`document.write` is banned** — it blocks the parser and is deprecated by
  browsers; the linter flags it on sight.
- **Worker offload** for CPU-heavy work (parsing, search, image transforms):
  move it off the main thread so INP stays flat during the work.

## 8. Budgets and measurement — numbers or it did not happen

A performance budget is a build gate, not a wish. Starting point for a content
or landing page (adjust per project, then enforce):

| Budget | Ceiling |
|---|---|
| HTML (compressed) | ≤ 100 KB |
| Critical JS on load | ≤ 170 KB compressed |
| LCP image | ≤ 100 KB compressed |
| Fonts (total, subset) | ≤ 200 KB |
| Long tasks on load | 0 above 100 ms |
| Head render-blocking resources | ≤ 2 |

Measure with the official library — field-style numbers in the lab and in RUM:

```html
<script type="module">
  import { onLCP, onINP, onCLS } from 'web-vitals';
  const log = (m) => console.log(m.name, m.value, m.rating); // send to analytics
  onLCP(log); onINP(log); onCLS(log);
</script>
```

- **Lab** (Lighthouse/DevTools LCP breakdown) explains *why*; **field**
  (CrUX + RUM) decides *whether you pass*. Debug with lab, report with field.
- **Throttled, mid-tier reality**: test on throttled 4G and a 4×-CPU-slowed
  profile, not your development laptop. `verify` (playwright-cli) can drive the
  page and collect the `web-vitals` callbacks in one session — screenshot the
  render *and* log the metrics from the same run.

## 9. The 12-point pre-ship audit

1. Static linter passes: `node skills/web-vitals/scripts/webvitals.mjs <files>`
   with zero high-severity findings.
2. Hero (LCP) image: eager, `fetchpriority="high"`, AVIF/WebP, ≤ 100 KB,
   correct `srcset`/`sizes`.
3. Every `<img>`/`<iframe>` has explicit `width` + `height` (or CSS
   `aspect-ratio`).
4. No classic script in `<head>` without `defer`/`async`; no `document.write`.
5. All `@font-face` blocks declare `font-display`; headline font preloaded
   (≤ 2 preloads) with metric-matched fallback.
6. Below-fold media lazy; nothing above the fold is lazy.
7. Dynamic content (ads, embeds, banners, consent UI) reserves space; overlays,
   never injects.
8. Skeletons mirror final geometry; spinners never used as layout placeholders.
9. No interaction handler exceeds ~50 ms of sync work; reads and writes batched.
10. Third-party scripts deferred/facaded; list reviewed and pruned this release.
11. Budgets table respected (HTML/JS/image/fonts); CI fails on regression.
12. Field check scheduled: `web-vitals` RUM live, CrUX reviewed at day 28.

Ship the audit result with the handoff note alongside the `a11y` 12-point audit —
one catches exclusion, this one catches slowness. A page that fails either list
is not done, no matter how the screenshot looks.
