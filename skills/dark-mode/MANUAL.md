---
name: design-dark-mode
description: >-
  Dark-mode theming module of design-arsenal. Apply whenever a dark theme is
  designed, implemented, or audited: dark palette re-tuning (not inversion),
  token architecture for themes (dark-as-a-file DTCG), the switching machinery
  (prefers-color-scheme + data-theme + three-mode toggle), the no-flash boot
  script, contrast re-verification per theme, elevation/image/icon handling,
  and theme transitions. Use when the user says: dark mode, dark theme, night
  mode, theme toggle, prefers-color-scheme, الوضع الداكن, الوضع الليلي, or when
  shipping any UI that must support both themes. Runs a zero-dependency audit
  script (theme.mjs). Read this file fully before work.
---

# design-dark-mode

Dark mode is not a color swap at the end of a project; it is a **second theme
built on the same semantic token layer** while the UI is being built. This
module gives you the re-tuning rules (what actually changes between themes),
the architecture (theme = data, not CSS overrides), the switching machinery,
and a script that turns "is my dark theme complete and accessible?" into
measurement. It composes directly with the other modules: `tokens` builds the
token architecture this module audits, `a11y` owns the contrast math this
module re-runs per theme, and `web-vitals` owns the one performance rule that
interacts with theming (the no-flash boot script, §4).

One script ships with this module (zero dependencies, Node 18+):

```bash
node skills/dark-mode/scripts/theme.mjs --tokens tokens.json
node skills/dark-mode/scripts/theme.mjs --tokens tokens.light.json --dark tokens.dark.json
node skills/dark-mode/scripts/theme.mjs --tokens tokens.light.json --dark tokens.dark.json --json  # CI-friendly
node skills/dark-mode/scripts/theme.mjs --boot      # print the no-flash boot script + toggle
node skills/dark-mode/scripts/theme.mjs --self-test # sanity check the auditor
```

## 1. Dark mode is re-tuning, not inversion

The most common dark-mode defect is `filter: invert(1)` thinking — mechanically
swapping #fff→#000. Real dark themes are **designed again with different
physics**:

| Role | Light | Dark | Why |
|---|---|---|---|
| Surface (base) | `#FFFFFF` | `#121212`–`#1E1E1E` | Pure `#000` flattens elevation and bleeds on OLED-smear; keep ~12% lightness |
| Text (primary) | `#1A1C1E`-range | `#E6E6E6`–`#ECECEC` | Pure `#fff` on dark vibrates and halates; dial back to ~90% |
| Text (muted) | gray-600 range | gray-400 range | Muted text loses ~1 contrast step in dark — re-pick, don't reuse |
| Brand accent | brand-600 | brand-300/400 | Saturated brand hues darken into the background; step *lighter* in dark |
| Shadows | blur-based | borders + lighter surfaces | See §6 |

Two rules cover 90% of the visual bugs:

- **Elevation = lighter, not darker.** In light themes higher elevation means
  a *stronger shadow*; in dark themes it means a *lighter surface* (`#121212`
  → `#1E1E1E` → `#262626` for card → sheet → dialog). If your dark surfaces
  are all one value, your elevation system is dead.
- **Every fg/bg pair is re-verified per theme.** A pair that passes 7:1 in
  light can drop below 4.5:1 in dark (and vice versa). Never reuse a contrast
  verdict across themes — the script audits both files in one run.

## 2. Theme = data: the token architecture

A theme is a set of values, not a set of CSS overrides. The architecture from
the `tokens` module applies verbatim:

- **Components reference semantic tokens only** (`--color-text`, `--color-surface`,
  `--color-border`). A component containing a light-only literal (`#fff`,
  `background: white`, `text-black`) cannot participate in theming — that is a
  defect even if dark mode "works for now".
- **Dark lives in its own file** (dark-mode-as-a-file): `tokens.light.json` and
  `tokens.dark.json` share the same semantic key set; only `$value` differs.
  Primitives stay in one shared file — gray ramps, brand ramps are theme-free.
- **Export produces the switch block**:

```css
:root, [data-theme="light"] { --color-surface: #ffffff; --color-text: #1a1c1e; }
[data-theme="dark"]         { --color-surface: #121212; --color-text: #e6e6e6; }
```

- Tailwind v4 projects: map semantic tokens in `@theme` and override under
  `[data-theme="dark"]` — never `@media (prefers-color-scheme: dark)` alone in
  project CSS, because it fights the user's manual toggle (§3).

Run the auditor before shipping either file:

```bash
node skills/dark-mode/scripts/theme.mjs --tokens tokens.light.json --dark tokens.dark.json
```

It reports: semantic tokens with **no dark override** (ERROR — the light value
silently survives), **extra** keys in dark (WARN — themes drifting), values
**identical in both themes** for text/surface roles (WARN — inversion thinking
leaked in), pure `#fff`-on-`#000` **glare** (WARN), and the full WCAG contrast
audit for every pair in *both* themes (ERROR < 4.5:1 text, < 3:1 icons).

## 3. The switching machinery — three sources of truth, one winner

Users control theme through three channels; resolve them in this exact order:

1. **Manual choice** — persisted (`localStorage["theme"]`: `"light"` / `"dark"`,
   *absent* = follow system). Absence must mean "system", otherwise users who
   once toggled can never return to automatic behavior.
2. **OS preference** — `matchMedia("(prefers-color-scheme: dark)")`.
3. **Fallback** — light.

The winning value lands on `<html data-theme="light|dark">`, and all CSS keys
off that attribute. Ship the **three-mode toggle** (light → dark → system),
not a two-way switch: label the state change with text or `aria-label`, and
announce it through a `role="status"` live region (the `--boot` snippet shows
the full pattern).

Also set, once, in `<head>`:

```html
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121212" media="(prefers-color-scheme: dark)">
```

`color-scheme` makes the browser paint its own chrome (scrollbars, form
controls, autofill) correctly per theme — without it, every native control
leaks the wrong theme.

## 4. The no-flash boot script — the sanctioned blocking exception

Without a boot script, a dark-mode user with a manual dark choice sees **one
frame of white on every reload** (FOUC — flash of incorrect theme). The fix is
a tiny *blocking inline script in `<head>`, before the stylesheet*:

```html
<script>
(function () {
  try {
    var s = localStorage.getItem("theme");
    var t = s === "light" || s === "dark"
      ? s
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = t;
  } catch (e) {}
})();
</script>
```

This is the **one sanctioned exception** to the `web-vitals` ban on
render-blocking head scripts: it is ~200 bytes, synchronous, touches no
network, and must run before first paint — that is its entire job. Everything
else (the toggle handler, analytics, the app) stays `defer`. The script must
be *inline* (not a module, not `defer`, not async) or the flash returns.

Full pattern including the three-mode toggle and CSS switch block:

```bash
node skills/dark-mode/scripts/theme.mjs --boot
```

## 5. Color discipline per theme — the contrast re-verification pass

The `a11y` module owns the math; this module owns the *per-theme* run:

1. Audit both token files (the script does light+dark in one invocation).
2. Fix failures in this order: adjust the **dark surface** first, then the
   **muted text step**, then swap the brand accent to its lighter ramp step.
   Changing hue is a last resort.
3. Check the pairs CSS alone can't see: form **autofill** (Chrome paints
   yellow unless `-webkit-box-shadow: inset` + `color-scheme` handle it),
   text **selection** (`::selection` in both themes), **scrollbar**,
   **focus rings** (must pass 3:1 against *both* surfaces), and **chart
   series colors** (red/green lines tuned for light often go muddy in dark).
4. Borders: decorative borders may sit below 3:1 (the script WARNs, not
   ERRORs); a border that is the *only* thing identifying a control must hit
   3:1 in both themes (WCAG 1.4.11).

Muted text is the chronic offender: gray-600 text that passes on white fails
on `#121212`. Keep a dedicated `--color-text-muted` **per theme** and never
calculate it with `opacity` — translucent black text on dark surfaces desaturates
 unpredictably and fails contrast silently.

## 6. Elevation, images, icons, media

- **Shadows in dark are invisible.** `box-shadow` needs a near-black backdrop
  plus a lit surface to read; on `#121212` it vanishes. Carry elevation with
  the surface-lightening ladder (§1) plus a subtle 1px border
  (`--color-border`) and, when needed, `0 0 0 1px` ring highlights.
- **Images and photos**: light-heavy photography *shines* on dark layouts —
  but screenshots and document scans glare. Offer `filter: brightness(.85)`
  on user-generated/document imagery in dark (a toggle, not forced), and keep
  product photography untouched.
- **Logos and illustrations**: if the logo is dark-only ink, ship a
  monochrome/positive variant for dark via the token layer (`--logo-src` swap
  or a `picture`/CSS swap) — never `filter: invert()` a brand mark; it mangles
  hues.
- **Icons**: stroke icons tuned for light (dark ink) flip token-driven; verify
  each icon passes 3:1 against its surface in both themes (the script checks
  `icon`-named tokens as ERROR). Emoji stay untouched.
- **Maps and data-viz**: dark map tiles and re-tuned chart palettes are part
  of the theme file, not per-component overrides.

## 7. The theme transition

Switching themes animates **color only, briefly**:

```css
:root { --theme-fade: 180ms; }
body, .themed { transition: background-color var(--theme-fade), color var(--theme-fade), border-color var(--theme-fade); }
@media (prefers-reduced-motion: reduce) { body, .themed { transition-duration: 0.01ms; } }
```

- 150–250ms, `ease`, colors only — **never** animate layout properties, and
  never slide/fade the whole page (vestibular hazard + looks broken).
- Set the transition *after* first paint (or scope it to a `.theme-anim` class
  added on first toggle) — otherwise the boot-time theme application itself
  animates and re-introduces a visible flash.
- Optional polish: the View Transitions API (`document.startViewTransition`)
  gives a clean cross-fade on modern browsers with the reduced-motion query
  still gating it. Ship it as an enhancement, not a dependency.

## 8. The testing matrix

Every change ships through both themes:

| Dimension | Values to cover |
|---|---|
| Theme | light · dark · system (with OS set to each) |
| Toggle state | fresh load (no localStorage) · after explicit choice · after "system" restore |
| Boot | reload on dark+manual-dark → **zero white flash** (screen-record at 60fps if unsure) |
| States | hover · focus-visible · active · disabled · error · empty |
| Natives | form autofill · `::selection` · scrollbar · date picker · `<dialog>` backdrop |
| Media | hero image · screenshot imagery · logo · charts |

Automate what the `verify` module can see: screenshot the same page in both
themes (`data-theme` set via script) at desktop + mobile widths, and diff
theming by eye only where automation can't (glare, halation, elevation).
The auditor's `--json` mode drops into CI as a hard gate on token parity.

## 9. The 10-point dark-mode audit before shipping

1. `theme.mjs --tokens light --dark dark` passes: zero ERROR findings; WARNings triaged.
2. Every semantic token has a dark override; primitives live in one shared file.
3. Zero light-only literals in components (`#fff`, `white`, `bg-white` on themed surfaces).
4. Surfaces follow the elevation ladder (`#121212` base, lighter with elevation) — no all-one-value surfaces.
5. Primary text is in the `#E6E6E6` range, muted text has its own dark step, both ≥ 4.5:1.
6. Brand accents stepped *lighter* in dark; focus rings pass 3:1 against both surfaces.
7. Three-mode toggle (light/dark/system) works; absent localStorage = system; state announced to screen readers.
8. No-flash boot script is inline, blocking, in `<head>` before the stylesheet; reload in dark shows zero flash.
9. `color-scheme` meta + CSS set; native controls (scrollbar, autofill, form widgets) render correctly in both themes.
10. Theme switch animates colors only, ≤250ms, with a `prefers-reduced-motion` guard; screenshots exist for both themes.

A dark theme that fails any point is not a dark theme — it is a light theme
wearing a black overlay. Run the audit, fix in the order given, and record
both themes' screenshots in the handoff note.
