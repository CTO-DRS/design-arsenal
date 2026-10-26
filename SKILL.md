---
name: design-arsenal
description: "ONE unified frontend design tool merging 10 capabilities into a single skill: designlang (extract any site's design system), taste-skill (anti-slop art direction), impeccable (24 design refinement commands), GSAP (advanced animation, 8 modules), transitions.dev (43+ production CSS transitions), react-bits (218 animated React components), playwright-cli (browser automation & testing), plus 3 original modules: rtl-arabic (Arabic/RTL interfaces), a11y (WCAG 2.2 AA accessibility), and design-tokens (DTCG token architecture & exports). One installation, one entry point, one workflow. Use when the user wants to: extract a design system from a URL, build/redesign/polish/critique/audit a frontend, add animation or transitions, use animated React components, automate/test a browser, build an Arabic or RTL interface, make UI accessible, or create design tokens. Triggers: 'extract design', 'design system', 'build a landing page', 'redesign', 'polish UI', 'animate this', 'GSAP', 'scroll animation', 'transition', 'modal animation', 'React component animation', 'slop', 'design review', 'test in browser', 'screenshot the page', 'Arabic', 'RTL', 'عربي', 'right-to-left', 'accessibility', 'a11y', 'WCAG', 'contrast', 'screen reader', 'aria', 'design tokens', 'DTCG', 'theme tokens', 'CSS variables theme'. This file is the single entry point: identify the matching module below, then read that module's MANUAL.md from disk."
license: Mixed — see ATTRIBUTION.md (MIT / Apache-2.0 / Free-for-use per tool)
---

# Design Arsenal — الأداة الموحدة لتصميم الواجهات

**One tool. One entry point. Ten modules.** This is a single skill — everything runs
through this file. Seven world-class upstream tools and three original modules are
not separate skills anymore; they are internal **modules**, each documented in a
`MANUAL.md` you read from disk when the task calls for it.

```
EXTRACT  →  TASTE  →  BUILD  →  MOTION  →  POLISH  →  VERIFY
 extract     taste     code      gsap /     impeccable   playwright-cli
 + design-tokens       react-bits  transitions
 rtl-arabic (context layer — any Arabic content)      a11y (gates every stage)
```

> **نظام أداة واحدة:** تُنصَّب هذه المهارة مرة واحدة كأداة واحدة باسم `design-arsenal`، وكل ما تفعله يمر عبر هذا الملف. الأدوات السبع السابقة أصبحت **وحدات داخلية** (مع 3 وحدات أصلية جديدة: rtl-arabic وa11y وdesign-tokens) — لا تُنصَّب منفردة ولا تظهر كأدوات مستقلة، بل تُقرأ أدلة استخدامها (`MANUAL.md`) من القرص عند الحاجة فقط.

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

**Overlaps → tie-breakers:**

- Building something **new** → `taste` first (direction), then `react-bits` or `gsap` while implementing.
- Redesigning something **existing** → `polish` audit/critique first, then `taste` if a new direction is needed.
- Pure **micro-interaction** (one element, open/close state) → `transitions` (CSS, cheap). Full scene choreography, scroll or physics → `gsap`.
- Machine-readable **tokens** (JSON/DTCG files) → `tokens`. Prose design brief from a live site → `extract`. Screenshot → tokens → `tokens` directly.
- **Any Arabic content at all** → read `rtl-arabic` before styling, regardless of which module leads.
- **Motion + accessibility question** → the `a11y` reduced-motion rules always win over motion richness.
- After ANY UI change → offer to verify with `verify` (screenshot the result).

---

## 🌳 Decision tree — route in four questions

Ask, in order, and stop at the first match:

1. **Does the content contain Arabic (or another RTL script)?** → add `rtl-arabic` as the context layer, then continue below.
2. **Is the input an existing design to consume?** URL → `extract`; screenshot/mockup → `tokens`; palette file → `tokens`.
3. **Is the task creating something new, or changing something that exists?** New → `taste` → build (pull from `react-bits`/`gsap`/`transitions` as needed). Existing → `polish` audit first (`/impeccable audit`), then `taste` only if a new direction is needed.
4. **What does the task end with?** Shipping UI → run `a11y` gates + `verify` screenshots. Producing a theme/token file → `tokens` exports + a11y audit of the pairs.

Read at most two `MANUAL.md` files per task; the three original modules may stack with one upstream module (e.g. `rtl-arabic` + `taste`).

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

---

## 📦 What's inside

```
design-arsenal/                  ← ONE skill, installed once
├── SKILL.md                     ← the single entry point (this file)
├── index.json                   ← machine-readable module index
├── install.sh                   ← one-command installer (all platforms)
├── ATTRIBUTION.md               ← sources & licenses
├── README.md                    ← الدليل الكامل بالعربية
├── demo/index.html              ← working demo of the motion stack
├── examples/gsap/               ← GSAP starter examples (react/vue/nuxt/vanilla)
└── skills/                      ← internal modules (reference manuals only)
    ├── extract-design/          ← designlang: URL → full design system (17+ files)
    ├── taste/                   ← taste-skill v2: 13 anti-slop rules + library + inspector
    ├── impeccable/              ← impeccable: 24 commands + 60+ detector rules + scripts
    ├── gsap/                    ← 8 GSAP modules: core/timeline/scrolltrigger/react/plugins/…
    ├── react-bits/              ← 218 animated React components (TS-CSS + TS-Tailwind) + catalog
    ├── transitions/             ← transitions.dev: 18 transition references + tokens
    └── playwright-cli/          ← browser automation module + 10 references
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

---

## ⚙️ One-time environment notes

- `extract` needs **Node 20+** and Playwright (`npx designlang <url>` handles install on first run).
- `polish` scripts are self-contained binaries in `skills/impeccable/scripts/`; on Windows without `sh` use `impeccable.cmd`.
- `taste` scripts are zero-dependency Node (`node skills/taste/scripts/lint.mjs src/`).
- `verify` needs `npm install -g @playwright/cli` + `playwright-cli install-browser chromium`.
- `components` local sources are plain files — copy from `ts-tailwind/` (Tailwind projects) or `ts-default/` (CSS projects), or use the live registry: `{"registries":{"@react-bits":"https://reactbits.dev/r/{name}.json"}}` in `components.json`.
- GSAP examples live in `examples/gsap/{vanilla,react,vue,nuxt}`.

## 🧠 Rules for the agent

1. **One tool, one entry.** All requests route through this file. If a task matches the pipeline, work module-by-module in pipeline order — do not look for the modules as separate installed skills; they are internal to this one.
2. **Read from disk.** Module paths are relative to this file's directory. Read the module's `MANUAL.md` fully before acting.
3. **Match, don't mix.** One task → one primary module. Stack modules only in the pipeline order above.
4. **Respect each module's bans.** `taste` bans templated looks; `impeccable` bans gray-on-color, nested cards, bounce easing; `transitions` and `a11y` require `prefers-reduced-motion` guards; `rtl-arabic` bans letterspacing on Arabic and physical `left/right` in RTL pages. When rules conflict, the stricter rule wins — and `a11y` safety rules outrank every aesthetic preference.
5. **Never invent component names.** For react-bits, use only names present in `skills/react-bits/catalog.json`; otherwise build from scratch under `taste` rules.
6. **Measure, don't eyeball.** Contrast claims come from `node skills/a11y/scripts/contrast.mjs`; token exports come from `node skills/design-tokens/scripts/convert.mjs`. If the scripts disagree with your eye, the scripts win.
7. **Arabic content routes through rtl-arabic.** The moment a task contains Arabic or RTL content, read `skills/rtl-arabic/MANUAL.md` before writing any CSS — even if another module leads.
8. **Attribution.** The seven upstream modules come from independent open-source projects — keep their licenses intact (see `ATTRIBUTION.md`). The three original modules (rtl-arabic, a11y, design-tokens) are part of this bundle.
