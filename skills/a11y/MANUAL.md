---
name: design-a11y
description: >-
  Practical accessibility module of design-arsenal. Apply whenever an interface is
  built, restyled, or audited: WCAG 2.2 AA contrast and focus rules, semantic HTML,
  ARIA patterns (dialog, tabs, toast), keyboard operability, form errors, motion and
  vestibular safety (prefers-reduced-motion), target sizes, and screen-reader basics.
  Use when the user says: accessible, a11y, WCAG, screen reader, keyboard, contrast,
  aria, focus trap, colour-blind, or when shipping any UI that will be audited.
  Runs zero-dependency scripts for contrast math. Read this file fully before work.
---

# design-a11y

Accessibility is not a feature pass at the end; it is a set of constraints applied
**while** the interface is built. This module gives you the AA baseline (WCAG 2.2),
the exact numbers to hit, the few ARIA patterns worth memorising, and a script
that turns contrast judgement into measurement. Everything here composes with the
other modules: `taste` palettes, `impeccable` polish, `gsap`/`transitions` motion,
and `react-bits` components must all pass through these gates before shipping.

One script ships with this module (zero dependencies, Node 18+):

```bash
node skills/a11y/scripts/contrast.mjs "#767676" "#ffffff"   # ratio for one pair
node skills/a11y/scripts/contrast.mjs --tokens tokens.json  # audit a DTCG token file
node skills/a11y/scripts/contrast.mjs --self-test           # sanity check the math
```

## 1. The baseline: WCAG 2.2 AA in one table

| What | Minimum | Notes |
|---|---|---|
| Body text | **4.5:1** | Under ~24px, or 19px bold |
| Large text | **3:1** | ≥24px (18.66px bold) and up |
| UI components + graphical objects | **3:1** | Borders, icons, input outlines, focus rings, chart lines |
| Focus indicator | **3:1** against adjacent colours | And ≥2px thick or clearly visible |
| Target size | **24×24px** | WCAG 2.2 — with spacing exception |
| Content reflow | 320px wide, no 2-axis scroll | Test at 400% zoom |
| Motion from interaction | Honour `prefers-reduced-motion` | See §7 |
| Flash | Never more than 3 general flashes/second | Seizure threshold |

AAA (7:1) is aspirational; claim it only where required (some government and
enterprise contracts). AA is the honest default for every project.

## 2. Contrast — measure, never eyeball

Perceived lightness is nonlinear, which is why #767676 on white (4.54:1) barely
passes while #777777 (4.48:1) fails. Never trust your eyes or how a screenshot
feels; run the script.

**Decision workflow for any palette** (from `taste`, `extract`, or your own pick):

1. Run `contrast.mjs --tokens` on the semantic token file (or pass pairs directly).
2. Fix failures in this order: darken/lighten the *foreground* first (text), then
   the surface, then only as a last resort change hue.
3. Re-run until every pair passes. Record the ratios in the PR or handoff note.

Rules that routinely bite:

- **Gray-on-color is banned** (`impeccable` already bans it; here is why: muted
  grays on saturated surfaces sit near 2.5–3.5:1 — a text fail).
- **Placeholder text** must still hit 4.5:1 — and placeholders are not labels (§6).
- **Disabled controls** are exempt from contrast minimums, but must still be
  announced with *why* they are disabled (§6).
- **Dark mode is not the light theme inverted**: white text on pure `#000` glares;
  use `#E6E6E6`-range text on `#121212`-range surfaces and re-verify every pair.

## 3. Semantic HTML first — 80% of a11y for 0% of ARIA

Before reaching for ARIA, make the platform do the work:

- **Landmarks**: one `<main>`, `<header>`, `<nav>` (label multiple ones with
  `aria-label`), `<aside>`, `<footer>`. Screen-reader users navigate by landmark.
- **Headings**: exactly one `<h1>`; never skip levels (`h2 → h4` is a defect);
  heading text must make sense out of context, because users jump by heading.
- **Buttons vs links**: action → `<button>`; navigation → `<a href>`. A `<div
  onClick>` is the single most common a11y defect in AI-generated UI. It is
  unreachable by keyboard, unnamed to the screen reader, and invisible to
  assistive tech. **Never ship it.**
- **Lists** for lists (`ul/ol/li`) — including nav bars, card grids, and feeds.
- **Tables**: real `<table>` with `<th scope="col|row">` for anything tabular.

## 4. ARIA — the four patterns worth knowing

First rule of ARIA: **don't use ARIA** (if native elements exist). When you must:

1. **Dialog**: `role="dialog"` + `aria-modal="true"` + `aria-labelledby` pointing
   at the title. On open: move focus into it (first focusable or the title). Trap
   Tab inside. Esc closes and focus returns to the trigger. Background is inert
   (`inert` attribute, or `aria-hidden` + pointer-events blocked).
2. **Tabs**: `role="tablist"` / `role="tab"` (`aria-selected`, roving `tabindex`)
   / `role="tabpanel"` labelled by its tab. Arrow keys move between tabs; Tab
   leaves the tablist into the panel.
3. **Toasts / live updates**: container with `role="status"` (polite) or
   `role="alert"` (assertive). Render the message *into* the existing live region
   — mounting a whole new region does not announce. Keep toasts ≥5s or dismissible.
4. **Toggles/accordions**: `aria-expanded` on the trigger, `aria-controls` to the
   region; `aria-pressed` for standalone toggle buttons; `aria-current="page"` on
   the active nav item.

Banned and common mistakes: `aria-label` on a `<span>` (non-interactive —
pointless), `role="presentation"` on focusable elements, `aria-hidden="true"` on
the visible focused element, positive `tabindex` values (only `0` and `-1`).

## 5. Keyboard — the whole interface, no mouse

- **Tab order = DOM order.** Never "fix" order with positive `tabindex`; reorder
  the DOM instead. `tabindex="0"` makes custom widgets focusable; `tabindex="-1"`
  allows programmatic focus only.
- **Visible focus is non-negotiable.** `outline: none` without a replacement is a
  hard defect. Use `:focus-visible` with a ≥2px, 3:1-contrast ring (offset 2px so
  it survives on matching surfaces).
- **Skip link** as the first focusable element on pages with repeated nav:
  visually hidden until focused, jumps to `#main`.
- **Escape hatch**: no keyboard traps — every state reachable by keyboard can be
  left by keyboard (menus: Esc; modals: Esc; carousels: stop on focus).
- **Shortcut keys** must be adjustable or trigger on keyup (WCAG 2.1.4).

Quick test you can run yourself: unplug the mouse. Complete the primary flow —
navigate, open, submit, close, undo. If a step is impossible, the build fails
regardless of how it looks. With `verify` (playwright-cli) you can automate part
of this: `playwright-cli press Tab` sequences and assert focus moves logically.

## 6. Forms — where users actually get stuck

- **Every input has a real `<label for>`.** Placeholder-only labels fail (they
  vanish on input, often fail contrast, and aren't announced reliably).
- **Errors announce themselves**: on submit failure, move focus to the first
  invalid field; each invalid field gets `aria-invalid="true"` +
  `aria-describedby` pointing at an error message *in text* (icon-only errors
  fail colour-independence).
- **`required`** (native) or `aria-required`; group related inputs in `<fieldset>`
  + `<legend>` (e.g. address, payment).
- **`autocomplete`** attributes (`name`, `email`, `new-password`, `one-time-code`)
  — WCAG 2.2 requires them for common fields; they also kill OTP friction.
- **Never disable the submit button** on invalid forms (users can't discover why
  it's dead). Validate on submit and announce errors instead.
- **OTP / card / phone fields** are LTR numeric islands even in RTL pages — set
  `dir="ltr"` + `inputmode` per field (see `rtl-arabic` §8 for the RTL side).

## 7. Motion — respect the inner ear

Vestibular disorders make large screen movement physically nauseating (estimates
put sensitivity above a third of adults). Therefore:

- **Guard every animation module's output**:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

  In GSAP use `gsap.matchMedia()` with `"(prefers-reduced-motion: no-preference)"`
  so scroll-pinning, parallax and scrub never run for opting-out users (the
  `gsap-core` and `gsap-react` manuals show the pattern).
- **Replace, don't just remove**: reduced-motion users still get feedback — swap
  movement for opacity fades; swap scroll-driven scenes for static compositions.
- **Autoplay**: any motion >5s must be pausable (WCAG 2.2.2). Carousels: pause on
  hover/focus, provide visible controls, never auto-advance while focused.
- **Parallax/zoom/spin >25°**: treat as vestibular hazards; gate behind the same
  query and keep them subtle (≤20px drift) even for motion-tolerant users.

## 8. Images, icons, charts

- **Alt text policy**: informative images get concise descriptive alt (~1
  sentence); decorative images get `alt=""` (presence of alt, *empty* — omitting
  the attribute makes screen readers announce the filename); functional images
  (icon-buttons) get `aria-label` on the control, `alt=""` on the img.
- **Icons** next to text labels are decorative (`aria-hidden="true"`); icon-only
  buttons must have `aria-label` (and a tooltip as a bonus, never as the only
  channel).
- **Charts**: don't encode meaning in colour alone — add direct labels, patterns,
  or an accessible data-table alternative; axis text must pass 3:1.

## 9. The 12-point audit you run before shipping

1. Contrast script passes on every semantic pair (text, borders, focus rings).
2. One `h1`; heading outline is monotonic and meaningful.
3. Primary flow completes with keyboard only; no traps; focus visible everywhere.
4. Modals: focus moved in, trapped, returned on close; Esc works.
5. Every input labelled; errors are text, announced, and focused on submit.
6. All interactive elements are `<button>`/`<a>`/native — zero `div onClick`.
7. Live regions announce toasts and async successes ("Saved ✓" in text).
8. `prefers-reduced-motion` honoured by every animation in the change set.
9. Targets ≥24×24px (or ≥24px apart); hover-only affordances also work on focus.
10. Alt text: informative described, decorative empty, functional labelled.
11. Page still works at 320px width and 200% text zoom (no clipped content).
12. Landmarks present; skip link is first; page `<title>` describes the view.

Run 1–4 (plus visual contrast) through `verify` screenshots where possible;
record the rest in the handoff note. Pair this with `/impeccable audit` — its
detectors catch visual slop; this list catches exclusion. Shipping UI that
fails either list is a failed task, no matter how good the screenshot looks.
