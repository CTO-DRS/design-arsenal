---
name: design-arsenal
description: "ONE unified frontend design tool merging 16 capabilities into a single skill: designlang (extract any site's design system), taste-skill (anti-slop art direction), impeccable (24 design refinement commands), GSAP (advanced animation, 8 modules), transitions.dev (43+ production CSS transitions), react-bits (218 animated React components), playwright-cli (browser automation & testing), plus 8 original modules: rtl-arabic (Arabic/RTL interfaces), a11y (WCAG 2.2 AA accessibility), design-tokens (DTCG token architecture & exports), web-vitals (Core Web Vitals performance), dark-mode (dark theme architecture & audit), responsive (fluid-first responsive design), forms (accessible forms & inputs), dataviz (accessible charts & dashboards), and i18n (Arabic-first internationalization: Intl formatting, plural rules, bidi isolation, locale-ready inputs). One installation, one entry point, one workflow. Use when the user wants to: extract a design system from a URL, build/redesign/polish/critique/audit a frontend, add animation or transitions, use animated React components, automate/test a browser, build an Arabic or RTL interface, make UI accessible, create design tokens, make a page fast/pass Core Web Vitals, implement/audit a dark theme with a flash-free toggle, make a layout fluid and responsive across all viewports, build/audit an accessible form (labels, validation, autocomplete, Arabic field direction), or build/audit accessible charts, dashboards and data visualizations (chart type, dual encoding, color-blind-safe palettes, RTL axes), or internationalize a product (Intl formatting, plural rules, mixed-direction isolation, Arabic webfonts). Triggers: 'extract design', 'design system', 'build a landing page', 'redesign', 'polish UI', 'animate this', 'GSAP', 'scroll animation', 'transition', 'modal animation', 'React component animation', 'slop', 'design review', 'test in browser', 'screenshot the page', 'Arabic', 'RTL', 'عربي', 'right-to-left', 'accessibility', 'a11y', 'WCAG', 'contrast', 'screen reader', 'aria', 'design tokens', 'DTCG', 'theme tokens', 'CSS variables theme', 'performance', 'slow page', 'lighthouse', 'core web vitals', 'LCP', 'INP', 'CLS', 'perf budget', 'render-blocking', 'dark mode', 'dark theme', 'night mode', 'theme toggle', 'prefers-color-scheme', 'الوضع الداكن', 'الوضع الليلي', 'أداء', 'بطيء', 'سرعة الموقع', 'responsive', 'mobile layout', 'fluid type', 'breakpoints', 'media queries', 'container queries', 'viewport', 'متجاوب', 'تصميم متجاوب', 'الجوال', 'الهاتف', 'form validation', 'input label', 'autocomplete', 'placeholder', 'OTP input', 'نموذج', 'نماذج', 'حقول الإدخال', 'تحقق النموذج', 'chart', 'charts', 'dashboard', 'bar chart', 'line chart', 'pie chart', 'sparkline', 'data visualization', 'color-blind palette', 'legend', 'رسم بياني', 'رسوم بيانية', 'مخطط', 'لوحة بيانات', 'لوحة تحكم', 'مؤشرات أداء', 'internationalization', 'i18n', 'localization', 'Intl', 'plural rules', 'pluralization', 'locale', 'hijri', 'تدويل', 'تعريب', 'تنسيق التاريخ', 'الأرقام العربية', 'تقويم هجري'. This file is the single entry point: identify the matching module below, then read that module's MANUAL.md from disk."
license: Mixed — see ATTRIBUTION.md (MIT / Apache-2.0 / Free-for-use per tool)
---

# Design Arsenal — الأداة الموحدة لتصميم الواجهات

**One tool. One entry point. Sixteen modules.** This is a single skill — everything runs
through this file. Seven world-class upstream tools and nine original modules are
not separate skills anymore; they are internal **modules**, each documented in a
`MANUAL.md` you read from disk when the task calls for it.

```
EXTRACT  →  TASTE  →  BUILD  →  MOTION  →  POLISH  →  VERIFY
 extract     taste     code      gsap /     impeccable   playwright-cli
 + design-tokens       react-bits  transitions
rtl-arabic (context layer — any Arabic content)
a11y (gates every stage)        web-vitals (budgets every stage)
dark-mode (theme layer — any themed UI, pairs with design-tokens)
responsive (fluid layer — every viewport, pairs with web-vitals/a11y)
forms (contract layer — every form, pairs with a11y/rtl-arabic)
dataviz (data layer — every chart/dashboard, pairs with a11y/rtl-arabic/responsive)
i18n (language layer — any localized UI, pairs with rtl-arabic)
```

> **نظام أداة واحدة:** تُنصَّب هذه المهارة مرة واحدة كأداة واحدة باسم `design-arsenal`، وكل ما تفعله يمر عبر هذا الملف. الأدوات السبع السابقة أصبحت **وحدات داخلية** (مع 9 وحدات أصلية: rtl-arabic وa11y وdesign-tokens وweb-vitals وdark-mode وresponsive وforms وdataviz وi18n) — لا تُنصَّب منفردة ولا تظهر كأدوات مستقلة، بل تُقرأ أدلة استخدامها (`MANUAL.md`) من القرص عند الحاجة فقط.

---

## 🧭 Module dispatch — read this table first

Identify **ONE** module from the task, read its `MANUAL.md` from disk (paths relative to
this file's directory), then follow it. Never load more than two modules for a single task.

| # | Task signal (what the user asks for) | Module | Read from disk |
|---|--------------------------------------|--------|----------------|
| 1 | Copy a website's design: "extract design from stripe.com", "what tokens/colors/fonts does this site use", "turn this URL into a Tailwind theme" | **extract** (designlang) | `skills/extract-design/MANUAL.md` |
| 2 | Art direction & anti-slop before building: "build a landing page", "design that doesn't look templated", "pick a palette/type direction" | **taste** (taste-skill v2) | `skills/taste/MANUAL.md` |
| 3 | Refine, review, or harden existing UI: "polish", "audit", "critique", "bolder", "quieter", "typeset", "colorize", "harden", "distill" | **polish** (impeccable, 24 commands) | `skills/impeccable/MANUAL.md` |
| 4 | Advanced programmatic animation: "GSAP", "scroll animation", "timeline", "ScrollTrigger", "stagger", "pinning" | **motion/gsap** (8 modules) | `skills/gsap/gsap-<module>/MANUAL.md` |
| 5 | Ready-made animated React components: "animated hero", "text effect", "animated background", "glare hover", "splitscreen" | **components** (react-bits, 218) | `skills/react-bits/CATALOG.md` |
| 6 | Micro-interactions & UI motion in CSS: "modal transition", "toast", "notification badge", "skeleton loader", "success check", "AI thinking state" | **motion/transitions** (43+ snippets) | `skills/transitions/transitions-dev/MANUAL.md` |
| 7 | Verify or automate: "test in browser", "screenshot", "check the flow works", "record a video", "click through the flow" | **verify** (playwright-cli) | `skills/playwright-cli/MANUAL.md` |
| 8 | Arabic/RTL interface: "Arabic UI", "RTL", "عربي", "right-to-left", "bidi", any content containing Arabic | **rtl-arabic** (original) | `skills/rtl-arabic/MANUAL.md` |
| 9 | Accessibility: "a11y", "accessible", "WCAG", "contrast", "aria", "screen reader", "keyboard" | **a11y** (original) | `skills/a11y/MANUAL.md` |
| 10 | Design tokens: "design tokens", "DTCG", "theme tokens", "CSS variables theme", "convert palette to Tailwind", "token architecture" | **tokens** (original) | `skills/design-tokens/MANUAL.md` |
| 11 | Performance: "slow page", "lighthouse", "core web vitals", "LCP", "INP", "CLS", "perf budget", "render-blocking", "أداء", "بطيء", "سرعة" | **web-vitals** (original) | `skills/web-vitals/MANUAL.md` |
| 12 | Dark theme: "dark mode", "dark theme", "night mode", "theme toggle", "prefers-color-scheme", "الوضع الداكن", "الوضع الليلي", or any UI that must ship in both light and dark | **dark-mode** (original) | `skills/dark-mode/MANUAL.md` |
| 13 | Responsive/fluid layout: "make it responsive", "mobile", "fluid type", "breakpoints", "media queries", "container queries", "overflow on small screens", "متجاوب", "الجوال" | **responsive** (original) | `skills/responsive/MANUAL.md` |
| 14 | Forms & inputs: "build a form", "signup form", "form validation", "input label", "autocomplete", "error message", "نموذج تسجيل", "حقول الإدخال" | **forms** (original) | `skills/forms/MANUAL.md` |
| 15 | Charts & dashboards: "bar chart", "dashboard", "data visualization", "pie chart", "sparkline", "KPI cards", "رسم بياني", "لوحة بيانات" | **dataviz** (original) | `skills/dataviz/MANUAL.md` |
| 16 | Internationalization: "i18n", "localization", "format dates in Arabic", "hijri calendar", "plural rules", "Arabic numerals", "تدويل", "تعريب", "تنسيق التاريخ", "الأرقام العربية" | **i18n** (original) | `skills/i18n/MANUAL.md` |

**Overlaps → tie-breakers:**

- Building something **new** → `taste` first (direction), then `react-bits` or `gsap` while implementing.
- Redesigning something **existing** → `polish` audit/critique first, then `taste` if a new direction is needed.
- Pure **micro-interaction** (one element, open/close state) → `transitions` (CSS, cheap). Full scene choreography, scroll or physics → `gsap`.
- Machine-readable **tokens** (JSON/DTCG files) → `tokens`. Prose design brief from a live site → `extract`. Screenshot → tokens → `tokens` directly.
- **Any Arabic content at all** → read `rtl-arabic` before styling, regardless of which module leads.
- **Motion + accessibility question** → the `a11y` reduced-motion rules always win over motion richness.
- **Motion + performance question** → `web-vitals` main-thread budget wins; animations ship only on `transform`/`opacity`.
- "Page is slow" → `web-vitals` static lint first (structural causes), then measure (§8 of its manual) — never guess a metric.
- Theme/token request → `tokens` builds the architecture; `dark-mode` audits and implements the switch (parity, boot, toggle). Dark palette without a token file → build the token file first.
- **Layout/viewport question** → `responsive` owns fluid type, grids, breakpoints, and overflow. It splits work with neighbours: an `<img>` question is **shape** (dimensions/aspect-ratio/srcset → `responsive`) plus **cost** (loading strategy → `web-vitals`); a zoom question is `responsive` (rem, no px root) enforced by `a11y` (WCAG 1.4.4).
- **Form question** → `forms` owns labels/names/autocomplete/validation wiring and Arabic field direction (dir/inputmode); visual field styling comes from `tokens`/`dark-mode`, and `a11y` still gates the result.
- **Chart/dashboard question** → `dataviz` owns chart type, dual encoding, series palettes and the data layer; axis direction inside RTL is `rtl-arabic` + `dataviz §6` together, chart cost/loading is `web-vitals`, and `a11y` (1.4.11 graphical contrast, names, alternatives) still gates the result.
- **Language/formatting question** → `i18n` owns Intl formatting, plural rules, mixed-direction isolation, and locale-ready inputs; direction and Arabic typography stay with `rtl-arabic`, and `a11y` still gates the result.
- After ANY UI change → offer to verify with `verify` (screenshot the result).

---

## 🌳 Decision tree — route in four questions

Ask, in order, and stop at the first match:

1. **Does the content contain Arabic (or another RTL script)?** → add `rtl-arabic` as the context layer, then continue below.
2. **Is the input an existing design to consume?** URL → `extract`; screenshot/mockup → `tokens`; palette file → `tokens`.
3. **Is the task creating something new, or changing something that exists?** New → `taste` → build (pull from `react-bits`/`gsap`/`transitions` as needed). Existing → `polish` audit first (`/impeccable audit`), then `taste` only if a new direction is needed.
4. **What does the task end with?** Shipping UI → run `a11y` gates + `web-vitals` lint + `responsive` lint (+ `forms` lint when the page contains forms, + `dataviz` lint when it contains charts/dashboards, + `i18n` lint when it formats dates/numbers or ships in more than one language) + `verify` screenshots (desktop **and** 320–390px widths). Producing a theme/token file → `tokens` exports + `dark-mode` parity audit + a11y audit of the pairs in both themes.

Read at most two `MANUAL.md` files per task; the nine original modules may stack with one upstream module (e.g. `rtl-arabic` + `taste`).

---

## 🚫 Anti-pattern registry — never ship these

Cross-module bans collected from the manuals. If your output contains one, the task is not done:

- A `<div onClick>` standing in for a button (a11y §3) — keyboard-dead, screen-reader-invisible.
- Gray-on-color text, or any fg/bg pair below 4.5:1 (a11y §2, impeccable ban) — run the contrast script instead of guessing.
- `outline: none` without a replacement focus ring (a11y §5).
- Animation without a `prefers-reduced-motion` guard (a11y §7, transitions rule) — the stricter rule wins.
- `letter-spacing` on Arabic text (rtl-arabic §3) — it breaks the connected script.
- Physical `left`/`right` CSS properties in an RTL page (rtl-arabic §1) — use logical properties.
- Hardcoded hex/px in components when a token file exists (tokens §7) — only token files carry raw values.
- GSAP for a one-element hover (use `transitions`) or CSS transitions for a scroll-choreographed scene (use `gsap`).
- A react-bits component name that is not in `catalog.json` — never invent one.
- Cards nested inside cards, bounce easing on UI, and the other impeccable slop tells — `/impeccable audit` catches them.
- `loading="lazy"` on the hero/LCP image (web-vitals §2) — the browser discovers the request only after layout.
- An `<img>` or `<iframe>` without explicit `width`/`height` (web-vitals §3) — guaranteed layout shift.
- A classic `<script src>` in `<head>` without `defer`/`async`, or any `document.write` (web-vitals §7).
- An `@font-face` without `font-display`, or a Google-Fonts stylesheet with no `preconnect` to fonts.gstatic.com (web-vitals §6).
- A dark theme built by inverting light values (`#fff→#000` swap) instead of re-tuned surfaces and text steps (dark-mode §1).
- A theme toggle that flashes the wrong theme on every reload — missing the no-flash boot script in `<head>` (dark-mode §4).
- Pure `#ffffff` text on pure `#000000` surfaces in dark mode (dark-mode §1) — glare and dead elevation; use the `#E6E6E6`/`#121212` ranges.
- Light-only literals (`#fff`, `white`, `bg-white`) on themed surfaces when a theme layer exists (dark-mode §2) — the component cannot participate in theming.
- A `<meta name="viewport">` with `user-scalable=no` or `maximum-scale` below 2 (responsive §2) — locks zoom, fails WCAG 1.4.4.
- `width: 100vw` on a container (responsive §4) — 100vw includes the scrollbar, so horizontal overflow ships with any vertical scroll; use `100%`/`100dvh`.
- `px` font-size on `html`/`:root`, or a layout container fixed at `width: NNNpx` ≥ 480px (responsive §3/§5) — breaks user zoom and reflow; run `responsive.mjs` instead of guessing.
- A placeholder doing the label's job — it vanishes on input and reads poorly; every control gets a real `<label for>` (forms §2).
- A `novalidate` form without a live region (`aria-live`/`role="alert"`) for its custom errors — validation failures are never announced (forms §4).
- A chart with no accessible name (no `role="img"` + `aria-label`/`<title>`) and no data-table alternative — the data is pixels nobody can read (dataviz §3).
- Values encoded by color alone (red/green series, swatch-only legend) — fails ~8% of male readers with color-vision deficiency; dual-encode or label directly (dataviz §3).
- A date or price formatted by hand (`${y}/${m}/${d}`, `.toFixed(2)`) instead of `Intl` (i18n §3) — correct in exactly one locale: the one you tested.
- One plural string for all counts, or an `(s)` suffix (i18n §4) — Arabic distinguishes zero/one/two/few/many/other via `Intl.PluralRules`.

---

## 📦 What's inside

```
design-arsenal/                  ← ONE skill, installed once
├── SKILL.md                     ← the single entry point (this file)
├── index.json                   ← machine-readable module index
├── install.sh                   ← one-command installer (all platforms)
├── ATTRIBUTION.md               ← sources & licenses
├── README.md                    ← الدليل الكامل بالعربية
├── logo/                        ← brand assets (logo.svg, icon.svg — original v2.4.0)
├── demo/                        ← demos (static, zero build)
│   ├── index.html               ← working demo of the motion stack
│   └── showcase.html            ← interactive Arabic showcase (themes, RTL, contrast)
├── examples/gsap/               ← GSAP starter examples (react/vue/nuxt/vanilla)
└── skills/                      ← internal modules (reference manuals only)
    ├── extract-design/          ← designlang: URL → full design system (17+ files)
    ├── taste/                   ← taste-skill v2: 13 anti-slop rules + library + inspector
    ├── impeccable/              ← impeccable: 24 commands + 60+ detector rules + scripts
    ├── gsap/                    ← 8 GSAP modules: core/timeline/scrolltrigger/react/plugins/…
    ├── react-bits/              ← 218 animated React components (TS-CSS + TS-Tailwind) + catalog
    ├── transitions/             ← transitions.dev: 18 transition references + tokens
    ├── playwright-cli/          ← browser automation module + 10 references
    ├── rtl-arabic/              ← original: Arabic/RTL interfaces (logical properties, typography, 10-point audit)
    ├── a11y/                    ← original: WCAG 2.2 AA gates + zero-dep contrast script
    ├── design-tokens/           ← original: DTCG architecture + multi-target converter
    ├── web-vitals/              ← original: Core Web Vitals playbook + static HTML linter
    ├── dark-mode/               ← original: dark theme architecture + zero-dep theme auditor
    ├── responsive/              ← original: fluid-first responsive system + zero-dep layout linter
    ├── forms/                   ← original: forms & inputs contract + zero-dep forms linter
    ├── dataviz/                 ← original: charts & dashboards guide + zero-dep dataviz linter
    └── i18n/                    ← original: Arabic-first i18n guide + zero-dep i18n linter
```

Every module directory contains a `MANUAL.md` (formerly its own SKILL.md). Because only
this root `SKILL.md` exists, your agent registers and loads **exactly one tool** — no
skill sprawl, no duplicate triggers, no context bloat from seven installed skills.

---

## 🚀 Fast starts

**Zero-to-landing-page (the full pipeline):**

1. (Optional recon) `extract` on 1–2 competitor URLs → tokens + patterns.
2. `taste` → read the brief, infer direction (type/palette/layout family), enforce bans.
3. Build. Pull motion from `transitions`, ready components from `react-bits`, scene work from `gsap`.
4. `polish` → `/impeccable polish` + `/impeccable audit` before shipping.
5. `verify` → screenshot desktop + mobile widths, confirm nothing broke.

**Just fixing ugly UI?** → `polish` alone (start: `/impeccable audit <target>`).
**Just animating?** → `transitions` for micro, `gsap` for scenes, never both on the same element.
**Making it responsive?** → `responsive`: lint first (`node skills/responsive/scripts/responsive.mjs src/`), then fluid type + auto-fit grids + container queries — breakpoints only for structural change.
**Building or fixing a form?** → `forms`: lint first (`node skills/forms/scripts/forms.mjs src/`), then labels/names/autocomplete/validation wiring — `a11y` gates still apply on top.
**Building a dashboard or chart?** → `dataviz`: lint first (`node skills/dataviz/scripts/dataviz.mjs src/`), then chart-type table + dual encoding + token series — `a11y`/`web-vitals`/`rtl-arabic` gates still apply on top.
**Localizing a product (Arabic first)?** → `i18n`: lint first (`node skills/i18n/scripts/i18n.mjs src/`), then Intl formatting + plural rules + bidi isolation — `rtl-arabic` still owns direction and typography.
**Page slow / vitals failing?** → `web-vitals`: lint the markup, apply the LCP/CLS/INP playbook, then measure (§8).

---

## ⚙️ One-time environment notes

- `extract` needs **Node 20+** and Playwright (`npx designlang <url>` handles install on first run).
- `polish` scripts are self-contained binaries in `skills/impeccable/scripts/`; on Windows without `sh` use `impeccable.cmd`.
- `taste` scripts are zero-dependency Node (`node skills/taste/scripts/lint.mjs src/`).
- `web-vitals` linter is zero-dependency Node 18+ (`node skills/web-vitals/scripts/webvitals.mjs page.html`).
- `responsive` linter is zero-dependency Node 18+ (`node skills/responsive/scripts/responsive.mjs page.html`).
- `forms` linter is zero-dependency Node 18+ (`node skills/forms/scripts/forms.mjs page.html`).
- `dataviz` linter is zero-dependency Node 18+ (`node skills/dataviz/scripts/dataviz.mjs page.html`).
- `i18n` linter is zero-dependency Node 18+ (`node skills/i18n/scripts/i18n.mjs page.html`).
- `verify` needs `npm install -g @playwright/cli` + `playwright-cli install-browser chromium`.
- `components` local sources are plain files — copy from `ts-tailwind/` (Tailwind projects) or `ts-default/` (CSS projects), or use the live registry: `{"registries":{"@react-bits":"https://reactbits.dev/r/{name}.json"}}` in `components.json`.
- GSAP examples live in `examples/gsap/{vanilla,react,vue,nuxt}`.

## 🧠 Rules for the agent

1. **One tool, one entry.** All requests route through this file. If a task matches the pipeline, work module-by-module in pipeline order — do not look for the modules as separate installed skills; they are internal to this one.
2. **Read from disk.** Module paths are relative to this file's directory. Read the module's `MANUAL.md` fully before acting.
3. **Match, don't mix.** One task → one primary module. Stack modules only in the pipeline order above.
4. **Respect each module's bans.** `taste` bans templated looks; `impeccable` bans gray-on-color, nested cards, bounce easing; `transitions` and `a11y` require `prefers-reduced-motion` guards; `rtl-arabic` bans letterspacing on Arabic and physical `left/right` in RTL pages; `web-vitals` bans lazy heroes, dimensionless media, and render-blocking head scripts. When rules conflict, the stricter rule wins — and `a11y` safety rules outrank every aesthetic preference.
5. **Never invent component names.** For react-bits, use only names present in `skills/react-bits/catalog.json`; otherwise build from scratch under `taste` rules.
6. **Measure, don't eyeball.** Contrast claims come from `node skills/a11y/scripts/contrast.mjs`; token exports come from `node skills/design-tokens/scripts/convert.mjs`; structural perf claims come from `node skills/web-vitals/scripts/webvitals.mjs`; dark-theme readiness claims come from `node skills/dark-mode/scripts/theme.mjs`; responsive-readiness claims come from `node skills/responsive/scripts/responsive.mjs`; forms-readiness claims come from `node skills/forms/scripts/forms.mjs`; chart-readiness claims come from `node skills/dataviz/scripts/dataviz.mjs`; locale-readiness claims come from `node skills/i18n/scripts/i18n.mjs`. If the scripts disagree with your eye, the scripts win.
7. **Arabic content routes through rtl-arabic.** The moment a task contains Arabic or RTL content, read `skills/rtl-arabic/MANUAL.md` before writing any CSS — even if another module leads.
8. **Attribution.** The seven upstream modules come from independent open-source projects — keep their licenses intact (see `ATTRIBUTION.md`). The nine original modules (rtl-arabic, a11y, design-tokens, web-vitals, dark-mode, responsive, forms, dataviz, i18n) are part of this bundle.
