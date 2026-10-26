# Attribution & Licenses — الإسناد والتراخيص

`design-arsenal` does **not** own these tools. It bundles independent open-source projects, unchanged, as internal modules of ONE skill so agents can use them together through a single entry point. Each project keeps its original license and its authors deserve the credit.

لا تملك أداة `design-arsenal` أيًّا من هذه الأدوات؛ هي تجميع لمشاريع مفتوحة المصدر مستقلة كوحدات داخلية لأداة واحدة بمدخل واحد، وكل وحدة تحتفظ بترخيصها الأصلي وكامل نسبتها لمؤلفيها.

| Tool (in bundle) | Upstream project | Author | License | Source |
|---|---|---|---|---|
| `skills/extract-design` | designlang / design-extract | Manavarya09 | MIT | https://github.com/Manavarya09/design-extract |
| `skills/taste` | Taste Skill (v2) | Leonxlnx | MIT | https://github.com/Leonxlnx/taste-skill |
| `skills/impeccable` | Impeccable | Paul Bakaus (pbakaus) | Apache-2.0 | https://github.com/pbakaus/impeccable |
| `skills/gsap/*` | GSAP Skills (official) | GreenSock / Webflow | MIT | https://github.com/greensock/gsap-skills |
| `skills/react-bits/*` | React Bits | David Haz (DavidHDev) | MIT (code); check repo for Pro assets | https://github.com/DavidHDev/react-bits |
| `skills/transitions/*` | Transitions.dev | Jakub Antalik (Jakubantalik) | Free for personal & commercial use; **no redistribution of the library itself** beyond the skill files (see upstream LICENSE.txt) | https://github.com/Jakubantalik/transitions.dev |
| `skills/playwright-cli` | Playwright CLI | Microsoft | Apache-2.0 | https://github.com/microsoft/playwright-cli |

## What this bundle modified

- **Added** (original content of this bundle): `SKILL.md` (the single entry point), `index.json`, `install.sh`, `README.md`, this file, `demo/index.html`, and the `examples/workflows/` walkthroughs.
- **Original modules added in v2.1.0** — authored for this bundle, no upstream source, licensed MIT as part of the bundle:
  - `skills/rtl-arabic/` — Arabic/RTL design guide (original content).
  - `skills/a11y/` — WCAG 2.2 AA guide + `scripts/contrast.mjs` (original content; WCAG success criteria are referenced by number, quoted from no document).
  - `skills/design-tokens/` — DTCG token architecture guide + `scripts/convert.mjs` (original content; the DTCG format is an open W3C Community Group draft).
- **Original module added in v2.2.0** — same terms as above:
  - `skills/web-vitals/` — Core Web Vitals guide + `scripts/webvitals.mjs` (original content; metric thresholds follow the publicly documented Good/Poor ranges of the web-vitals initiative, referenced by value only).
- **Renamed (v2 single-tool architecture)**: every upstream `SKILL.md` inside `skills/` was renamed to `MANUAL.md` so that only ONE skill registers with the agent; internal cross-references were updated accordingly. File contents were not otherwise altered.
- **Transformed**: `skills/impeccable/MANUAL.md` (formerly its SKILL.md) was compiled from upstream `SKILL.src.md` by substituting template variables (`{{scripts_path}}` → `<skill-base-dir>/scripts`, `{{command_prefix}}` → `/impeccable ` — including the trailing space the command grammar needs, `{{command_hint}}` → `<command>`). No rules were added, removed, or reworded.
- **Generated**: `skills/react-bits/CATALOG.md` and `catalog.json` were generated programmatically from the upstream component directory listing — no component code was modified.
- **Unchanged**: every other file is a verbatim copy from the upstream repos at their current `main` branches (cloned 2026-10-26).
- **CI note**: the monthly refresh workflow (`tools/build-bundle.sh` + `.github/workflows/refresh.yml`) rebuilds upstream content only — the four original module directories above are excluded from its rsync sync and are never overwritten.

## React Bits components notice

Only the component source folders `ts-default/` and `ts-tailwind/` are included (MIT). React Bits **Pro** assets, templates, and the Agent Kit are **not** included and were never downloaded. For always-fresh components prefer the upstream registry: `{"registries":{"@react-bits":"https://reactbits.dev/r/{name}.json"}}`.

## Transitions.dev redistribution notice

The upstream license permits use in personal and commercial projects but restricts redistributing the library itself. This bundle redistributes only the **agent skill files** (`skills/transitions-*`), exactly as upstream ships them for installation via `npx skills add Jakubantalik/transitions.dev`. If you redistribute this bundle further, keep this notice and the upstream `LICENSE.txt` files intact.

## GSAP runtime notice

The GSAP skills teach the API. The GSAP **runtime** itself is not included — install per project (`npm install gsap` or `gsap` CDN). Standard (free) plugins are covered; verify license for any bonus/Club plugin on gsap.com.
