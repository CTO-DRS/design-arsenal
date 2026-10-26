---
name: design-rtl-arabic
description: >-
  Arabic & RTL design module of design-arsenal (original). Use when any interface
  contains Arabic, Hebrew, Persian, or Urdu content, or when the user says: RTL,
  right-to-left, عربي, بالعربي, Arabic UI, bidi, bilingual. Covers logical CSS
  properties, Arabic typography (fonts, line-height, the letterspacing ban),
  numerals, layout mirroring, icon flipping, forms, Tailwind rtl: utilities, and
  GSAP-under-RTL. Read fully before styling any RTL interface.
---

# design-rtl-arabic — التصميم العربي وRTL

An RTL interface is not a mirrored LTR one with `dir="rtl"` sprinkled on top. The
script is connected, the letterforms carry meaning the Latin grid never thinks
about, and half the web's layout primitives silently assume left-to-right. This
module is the checklist that keeps an Arabic build from looking like a translated
afterthought. It applies **on top of** the primary module: if the task is a
landing page, `taste` still directs it — this file overrides its LTR assumptions.

## 1. The one rule that does 90% of the work: logical properties

Stop writing physical directions. `left`/`right` become wrong the moment the
document direction changes; `start`/`end` are always correct.

| Physical (banned in RTL work) | Logical (use this) |
|---|---|
| `margin-left` | `margin-inline-start` |
| `margin-right` | `margin-inline-end` |
| `padding-left/right` | `padding-inline-start/end` |
| `border-left` | `border-inline-start` |
| `text-align: left/right` | `text-align: start/end` |
| `left: 0 / right: 0` | `inset-inline-start/end` |
| `top-left` radius | `border-start-start-radius` |
| `translateX(-8px)` | `translate` + logical var, or flip per §5 |

Flexbox, grid, and `gap` already respect `dir` — use them freely. The moment you
inherit a stylesheet, grep it: `rg "margin-?(left|right)|padding-?(left|right)|text-align: ?(left|right)"` — every hit in an RTL page is a bug.

## 2. Direction plumbing

```html
<html lang="ar" dir="rtl">
```

- `dir` goes on `<html>`, **once**. Components inherit it; never re-declare `dir="rtl"` deep in the tree (it breaks nesting of embedded LTR content).
- **User-generated or mixed content** (names, comments, chat): `dir="auto"` per element, and wrap user strings in `<bdi>` so an Arabic username cannot flip a Latin sentence around it.
- `<html lang="ar">` — screen readers pick the correct voice only if `lang` is real. Bilingual site? `lang` switches per subtree (`<p lang="en">`).
- Numbers, code, phone numbers, formulae: `dir="ltr"` islands inside RTL text (§8).

## 3. Typography — where Arabic design lives or dies

**The first ban: never letterspace Arabic.** Arabic is a connected cursive
script; `letter-spacing` tears the joins apart and reads as broken type. Apply
tracking to Latin/numerals only (`:lang(en) { letter-spacing: … }`). This
overrides `taste`'s display-tracking suggestions: for Arabic headlines the
equivalent of tracking is **weight contrast** — light-to-black jumps within one
family, not spacing.

**Line-height runs taller.** Ascenders, descenders, dots, and diacritics need
air: Arabic body text wants **1.7–1.9** (Latin's 1.4–1.5 clips diacritics and
collapses rows). Display sizes tolerate 1.2–1.4. Never set `line-height: 1` on
Arabic — diacritics will collide with the line above.

**Font choices that actually ship** (all on Google Fonts, all variable-friendly):

| Role | Fonts | Character |
|---|---|---|
| Modern UI / tech | **IBM Plex Sans Arabic**, Rubik, Readex Pro | Neutral, engineered, pairs with its Latin sibling |
| Editorial body | **Noto Naskh Arabic**, Amiri | Traditional naskh, dense text stays calm |
| Geometric display | **Cairo**, Tajawal, Almarai, Changa | Big, confident headlines |
| Kufi / brand moments | **Reem Kufi**, Noto Kufi Arabic | Decorative, use sparingly |

- Pair each Arabic family with a **Latin companion from the same superfamily** (IBM Plex Sans ↔ IBM Plex Sans Arabic; Rubik ↔ Rubik) so mixed strings share a skeleton.
- Arabic renders optically smaller at equal px — bump body size **1–2px** vs the Latin spec (18px Latin → 19–20px Arabic).
- `font-feature-settings` for numerals per §4; test diacritics (`تشكيل`) at small sizes — some free fonts drop marks at 14px.
- Amiri is gorgeous and is a *serif/naskh* voice — don't use it for dashboards.

## 4. Numerals and money

Three numeral systems coexist: Western `123`, Arabic-Indic `١٢٣`, and Eastern
Arabic-Indic `۱۲۳` (Persian). Decide per product, then hold the line:

- **Fintech/dashboards/technical**: Western digits + `dir="ltr"` on the figure. Every Arabic fintech UI you admire does this; mixing `١٢٣٤٥٦٧٨٩٠٫٥٦` into a KPI tile is unreadable.
- **Editorial/religious/cultural**: Arabic-Indic (`٠١٢٣٤٥٦٧٨٩`) via font feature (`ss01` in some fonts) or literal characters.
- Currency, OTP, phone numbers, dates in forms: always LTR islands (`dir="ltr"`), even when labels are Arabic. Currency symbols go *after* the number in Arabic prose (`١٢٠ ريالًا`) but `SAR 120` in data tables.
- Bidi gotcha: a trailing Latin string or number can jump to the wrong end of a line. Wrap each mixed run in `<bdi>` or add `&lrm;` — test with "iPhone 15 بـ 4,299 ريال".

## 5. Mirroring: what flips, what doesn't

**Flips with the page** (automatic via `dir` — do nothing): flex order, grid
columns, text-align, borders/paddings using logical props, carousel track
direction, accordion chevron position (if positioned with logical props).

**Flips, but only if you do it:**

- **Directional icons**: back/forward arrows, chevrons, "next", undo, reply, share, indent. `html[dir="rtl"] .icon-arrow { transform: scaleX(-1); }` — or ship two SVGs and swap. Icons that flip: arrows, chevrons, playback-next. Icons that must **not** flip: clock, camera, search, brand marks, music note, chart bars that read as data.
- **`translateX` / `xPercent` in animations**: GSAP `x: 100` slides *right* in both directions. In RTL that reads as "backwards". Flip the sign at the animation layer: `const dir = document.dir === "rtl" ? -1 : 1; gsap.to(el, { x: 100 * dir })`. The `gsap` module's ScrollTrigger horizontal-scroll recipes need the same treatment (and `ScrollTrigger` pinned sections keep LTR math — test both directions).
- **CSS `float`, `box-shadow` offsets** (`-4px 0 0 …`), asymmetric gradients (`to left`), and `background-position` percentages — audit all of them.
- **Progress / stepper / timeline order**: steps flow right→left; the connecting line fills right→left.

**Never mirrors** (stays LTR inside the RTL page): code blocks, math, phone/OTP inputs, file paths, media player timelines, tables of figures (columns stay in data order), embedded Latin charts.

## 6. Tailwind RTL in practice

- Use logical utilities natively: `ms-4 me-2 ps-6 pe-8 text-start text-end start-0 end-0` (Tailwind ≥3.3 maps to logical properties). `ml-4` is the RTL bug factory — grep for `m[trbl]-` and `text-(left|right)`.
- `rtl:` / `ltr:` variants for the irreducible cases: `rtl:rotate-180` on chevrons, `ltr:hidden` for swapped art.
- **`space-x-*` is broken for RTL** (it uses `margin-left`). Use `gap` (flex/grid) or `divide-x` — both direction-aware.
- Test with `dir` flipped at `<html>` only; Tailwind's `rtl:` variant keys off `[dir="rtl"]` anywhere, so stray mid-tree `dir` attributes cause phantom styles.

## 7. Forms and input

- Labels align to the inline **start** (right, in Arabic) — logical props again.
- Every text input takes `dir="auto"` so Arabic input aligns right, Latin input left, automatically. Explicit `dir="ltr"` + `inputmode="numeric"`/`"tel"` for OTP, phone, card, IBAN.
- Select/caret position, native date pickers, and `::placeholder` alignment follow `dir` — verify per browser.
- Validation icons sit at inline-end; error text starts aligned with the field's text direction (`dir="auto"` on the message too).
- Number inputs: Arabic keyboard layouts still emit Western digits — accept both, normalize on save.

## 8. The 10-point RTL audit

1. `dir="rtl"` + `lang="ar"` on `<html>`; zero stray `dir` deep in the tree (except LTR islands).
2. `rg "(margin|padding|inset|border)-(left|right)"` in changed CSS → zero hits.
3. Zero `letter-spacing` on Arabic runs; Latin tracking scoped with `:lang()`.
4. Body line-height ≥1.7 for Arabic paragraphs; no clipped diacritics at any size.
5. Numerals policy applied consistently; money/OTP/phone are LTR islands.
6. Directional icons flipped; non-directional icons untouched; no flipped clock/camera.
7. `translateX`/GSAP `x` values sign-checked for RTL; pinned scroll scenes tested.
8. Mixed bidi strings (`<bdi>`) render in correct order — test the "iPhone 15 بـ 4,299" sentence.
9. `space-x` replaced by `gap`/`divide`; logical Tailwind utilities throughout.
10. Form flow: labels right-aligned, errors start-aligned, autocomplete works with Arabic input.

Finish with the `verify` module: screenshot the page with `dir="rtl"` and with a
mixed Arabic/Latin paragraph containing numbers and a Latin brand name — that
single screenshot exposes most mirroring and bidi defects at once.
