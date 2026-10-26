---
name: design-design-tokens
description: >-
  Design tokens module of design-arsenal (original). Turn any screenshot, URL, or
  brief into a tiered DTCG token architecture (primitives → semantic → component)
  and export it to CSS variables, Tailwind v3/v4, shadcn themes, or Figma
  variables. Use when the user says: design tokens, DTCG, token file, theme
  tokens, CSS variables theme, "extract colors and make a theme", "convert this
  palette to Tailwind", dark mode architecture. Includes a zero-dependency
  converter script. Read fully before creating or refactoring any token set.
---

# design-design-tokens

Tokens are the contract between design decisions and code. This module produces
them from anything — a screenshot, an extracted site (via the `extract` module),
or a written brief — and exports them to whatever the stack consumes. It pairs
with `extract` (which harvests raw values from a live URL), `a11y` (which audits
the semantic pairs you define), and `taste` (which decides *which* palette
deserves to become tokens in the first place).

Converter script (zero dependencies, Node 18+):

```bash
node skills/design-tokens/scripts/convert.mjs tokens.json --to css        > theme.css
node skills/design-tokens/scripts/convert.mjs tokens.json --to tailwind3  > tailwind.config.js
node skills/design-tokens/scripts/convert.mjs tokens.json --to tailwind4  > theme.css
node skills/design-tokens/scripts/convert.mjs tokens.json --to figma      > figma-variables.json
node skills/design-tokens/scripts/convert.mjs --self-test
```

## 1. The format: W3C DTCG

Standard `.tokens.json` files (Draft Community Group format — the one Figma
Tokens Studio, Style Dictionary, and Tailwind tooling all speak):

```json
{
  "color": {
    "blue": {
      "500": { "$type": "color", "$value": "#3B82F6", "$description": "primary action" }
    }
  },
  "color-surface": { "$type": "color", "$value": "{color.blue.950}" }
}
```

Rules: `$type` on every leaf (`color`, `dimension`, `fontFamily`, `fontWeight`,
`duration`, `cubicBezier`, `shadow`, `radius`, `number`); references are
`{path.to.token}`; file extension `.tokens.json` (split multi-file sets as
`colors.tokens.json`, `typography.tokens.json`…).

## 2. The three tiers (never skip one)

1. **Primitives** — the raw palette and scales, named by value not purpose:
   `color.blue.500`, `space.4` (=16px), `font.size.3`. Hundreds of them, never
   referenced by components directly.
2. **Semantic** — the purpose layer components actually use:
   `color-surface`, `color-fg-body`, `color-action`, `space-gutter`,
   `radius-card`, `duration-fast`. Small, curated, theme-swappable.
3. **Component** — overrides only where a component genuinely diverges:
   `button-primary-bg` = `{color-action}` until proven otherwise. Start with
   zero component tokens; add one only when two components need the same
   semantic value differently.

**Naming grammar**: `domain-property-variant-state` — `button-primary-bg-hover`,
`card-border-subtle`. Kebab-case everywhere. A name describes **purpose**, never
value: `color-danger` yes, `color-red` no.

The test of a good semantic layer: **dark mode is a file, not a refactor.**
`dark.tokens.json` redefines only the semantic tier's *values*; components never
change.

## 3. From screenshot → tokens (the harvest workflow)

When the user hands you a screenshot, mockup, or "make it look like this":

1. **Inventory the visual facts**: background surfaces (count them — usually
   2–3), foreground/text colors, one dominant action color, accent(s), radii
   (small/med/large — usually 3 stops), shadow depth (0–2 levels), type scale
   (5–7 sizes), spacing rhythm (almost always a 4px or 8px grid).
2. **Normalize to primitives**: snap every sampled color to the closest step of
   a ramp you generate (50→950); snap spacing to the 4px grid; snap font sizes
   to a modular scale (1.2 minor-third or 1.25 major-third).
3. **Name the semantics**: map inventory → `color-bg`, `color-surface`,
   `color-surface-raised`, `color-fg`, `color-fg-muted`, `color-action`,
   `color-fg-on-action`, `color-border`, `color-danger`…
4. **Audit before shipping**: run `node skills/a11y/scripts/contrast.mjs
   --tokens tokens.json` — every fg/bg pair must clear 4.5:1 (body) before you
   write a line of CSS. Fix in the token file, not ad hoc in components.
5. **Export** with `convert.mjs --to <target>` and wire the output into the
   project.

Working from a live URL instead? Run `extract` first (it outputs DTCG directly),
then this module takes over at step 2 — refining, tiering, and naming what
designlang harvested.

## 4. Reference scales you ship by default

- **Space (4px grid)**: 1=4, 2=8, 3=12, 4=16, 5=24, 6=32, 8=48, 10=64, 12=80, 16=128
- **Radius**: xs=4, sm=8, md=12, lg=16, xl=24, full=9999 (pick 3 as your house stops via semantics: `radius-input`, `radius-card`, `radius-pill`)
- **Type scale (1.25)**: sm=14, base=16, lg=20, xl=25, 2xl=31, 3xl=39, 4xl=49 — Arabic body line-height 1.8 baked into the typography tokens (see `rtl-arabic` §3)
- **Shadow**: two depths + none (`shadow-card`, `shadow-pop`) — more than two depths is noise
- **Motion** (aligns with the transitions.dev motion tokens): `duration-fast`=150ms, `duration-base`=250ms, `duration-slow`=400ms, `ease-out`=cubic-bezier(0.16,1,0.3,1), `ease-spring`=cubic-bezier(0.34,1.56,0.64,1)

## 5. Exports — one source, every target

| Target | Command | Output shape |
|---|---|---|
| CSS variables | `--to css` | `:root { --color-blue-500: … }` (dotted paths → kebab vars) |
| Tailwind v3 | `--to tailwind3` | `module.exports = { theme: { extend: { colors: … } } }` |
| Tailwind v4 | `--to tailwind4` | `@theme { --color-blue-500: … }` block |
| Figma | `--to figma` | Variables-ready JSON grouped by mode |

The converter resolves `{references}` before exporting, so outputs are
flat and self-contained. Regenerate after every token change — **never
hand-edit generated files** (put `// generated from tokens.json` headers in your
review checklist).

## 6. Dark mode architecture

Two files, one semantic contract:

- `light.tokens.json` — semantic tier bound to light values
- `dark.tokens.json` — same semantic names, dark values (surfaces get *lighter* as they rise: `#121212` base → `#1E1E1E` raised; text never pure `#fff` — use `#E6E6E6`; re-run the a11y audit per theme)

Switch by swapping a `data-theme` attribute that the CSS export maps to
(`:root[data-theme="dark"]`), or by Tailwind's `dark:` class strategy — but the
token values live in the token files either way. If a dark theme needs different
*structure* than light (not just values), the semantic tier was designed wrong:
fix the tiers, not the components.

## 7. Anti-patterns (all common in AI-generated UI)

- **Flat namespace**: 200 top-level tokens, no tiers — every refactor touches everything.
- **Value-named semantics**: `color-gray-500` used as the body-text token; rebrand breaks every component.
- **Hex in components**: even one `#3B82F6` hardcoded in a component defeats the entire system. Grep for `[0-9a-fA-F]{6}` in source after export — only token files may contain hex.
- **Skip-tier shortcuts**: components referencing primitives (`color.blue.500`) directly; the day blue-500 shifts for *one* purpose, everything shifts.
- **Unsnapped spacing**: 13px, 17px, 22px margins — evidence nobody made a grid. Snap to 4px.
- **Tokens without audit**: shipping a palette whose fg/bg pairs fail 4.5:1 — run the a11y script, always.

## 8. Handoff checklist

1. `tokens/*.tokens.json` committed, DTCG-valid, every leaf typed.
2. Semantic tier ≤ ~40 tokens; dark theme is a value swap, nothing more.
3. `contrast.mjs --tokens` passes for every theme.
4. Exports regenerated (css/tailwind) and checked in; generation command documented in README.
5. Zero hex/px literals in component source outside the token files.
