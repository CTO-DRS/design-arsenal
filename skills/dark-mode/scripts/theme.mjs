#!/usr/bin/env node
/**
 * theme.mjs — dark-mode readiness auditor for design-arsenal (zero dependencies, Node 18+).
 *
 * What it does:
 *   1. Walks a DTCG token file and separates primitives from semantic color tokens.
 *   2. With --dark <file.json>: diffs the dark theme against the light one —
 *      missing overrides (ERROR), extra keys (WARN), values that did not change
 *      for text/surface roles (WARN — "suspicious invariant"), and glare checks
 *      (#ffffff text / #000000 surface in dark).
 *   3. Audits WCAG contrast for every fg/bg pair in BOTH themes (same math as
 *      skills/a11y/scripts/contrast.mjs) — text roles 4.5:1, ui roles 3:1.
 *   4. --boot prints the no-flash boot script + three-mode toggle (copy-paste).
 *
 * Usage:
 *   node theme.mjs --tokens tokens.json              # audit light file alone
 *   node theme.mjs --tokens light.json --dark dark.json   # full parity + contrast audit
 *   node theme.mjs --tokens light.json --dark dark.json --json   # machine-readable
 *   node theme.mjs --boot                            # print the no-flash boot snippet
 *   node theme.mjs --self-test                       # built-in verification
 *
 * Exit codes: 0 = clean (no ERROR), 1 = at least one ERROR finding.
 */

import { readFileSync } from "node:fs";

/* ------------------------------------------------------------------ utils */

const isColor = (v) =>
  typeof v === "string" &&
  /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim());

function hexToRgb(hex) {
  let h = hex.trim().slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function relLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fgHex, bgHex) {
  const L1 = relLuminance(fgHex);
  const L2 = relLuminance(bgHex);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

/* Walk a DTCG tree → [{ path: "a.b.c", value, $type }] for color leaf tokens. */
function walkColors(node, out = [], trail = []) {
  if (node === null || typeof node !== "object") return out;
  if ("$value" in node || "value" in node) {
    const raw = node.$value ?? node.value;
    const type = node.$type ?? "";
    if (isColor(String(raw))) out.push({ path: trail.join("."), value: String(raw).trim(), type });
    return out;
  }
  for (const [k, v] of Object.entries(node)) walkColors(v, out, [...trail, k]);
  return out;
}

const PRIMITIVE_ROOTS = /^(primitives?|base|refs?|reference|palette|raw)$/i;

/* Role detection (same spirit as contrast.mjs) */
const FG_ROLE = /(?:^|[-_.])(fg|foreground|text|content|label|heading|body)(?:$|[-_.A-Z0-9])|^(?:on[-_])/i;
const BG_ROLE = /(?:^|[-_.])(bg|background|surface|canvas|layer|panel|card)(?:$|[-_.A-Z0-9])/i;
const ICON_ROLE = /(?:^|[-_.])icon(?:$|[-_.A-Z0-9])/i;
const BORDER_ROLE = /(?:^|[-_.])(border|divider|outline)(?:$|[-_.A-Z0-9])/i;

/* scope = path before the first role piece → prevents dark.fg ↔ light.bg pairing */
function scopeOf(path) {
  const parts = path.split(".");
  const idx = parts.findIndex((p) => FG_ROLE.test(p) || BG_ROLE.test(p) || ICON_ROLE.test(p) || BORDER_ROLE.test(p));
  return idx === -1 ? "" : parts.slice(0, idx).join(".");
}

function roleOf(path) {
  const leaf = path.split(".");
  if (leaf.some((p) => FG_ROLE.test(p))) return "text";
  if (leaf.some((p) => ICON_ROLE.test(p))) return "icon";
  if (leaf.some((p) => BORDER_ROLE.test(p))) return "border";
  if (leaf.some((p) => BG_ROLE.test(p))) return "surface";
  return "other";
}

/* Pair fg↔bg inside the same scope; ui roles are checked against surfaces too. */
function auditContrast(tokens, themeLabel, findings) {
  const byScope = new Map();
  for (const t of tokens) {
    const s = scopeOf(t.path);
    if (!byScope.has(s)) byScope.set(s, []);
    byScope.get(s).push(t);
  }
  let pairs = 0;
  for (const [, group] of byScope) {
    const texts = group.filter((t) => roleOf(t.path) === "text");
    const icons = group.filter((t) => roleOf(t.path) === "icon");
    const borders = group.filter((t) => roleOf(t.path) === "border");
    const surfaces = group.filter((t) => roleOf(t.path) === "surface");
    for (const fg of texts) {
      for (const bg of surfaces) {
        pairs++;
        const r = contrastRatio(fg.value, bg.value);
        if (r < 4.5) {
          findings.push({
            severity: "ERROR",
            code: "CONTRAST-TEXT",
            theme: themeLabel,
            token: `${fg.path} ⇄ ${bg.path}`,
            message: `text contrast ${r.toFixed(2)}:1 < 4.5:1 (${fg.value} on ${bg.value})`,
          });
        }
      }
    }
    // icons carry required visual information → ERROR at <3:1 (WCAG 1.4.11)
    for (const ic of icons) {
      for (const bg of surfaces) {
        pairs++;
        const r = contrastRatio(ic.value, bg.value);
        if (r < 3) {
          findings.push({
            severity: "ERROR",
            code: "CONTRAST-ICON",
            theme: themeLabel,
            token: `${ic.path} ⇄ ${bg.path}`,
            message: `icon contrast ${r.toFixed(2)}:1 < 3:1 (${ic.value} on ${bg.value})`,
          });
        }
      }
    }
    // borders are often decorative → WARN only; must hit 3:1 when they are
    // the ONLY thing identifying a control (audit manually, dark-mode §5)
    for (const bd of borders) {
      for (const bg of surfaces) {
        pairs++;
        const r = contrastRatio(bd.value, bg.value);
        if (r < 3) {
          findings.push({
            severity: "WARN",
            code: "CONTRAST-BORDER",
            theme: themeLabel,
            token: `${bd.path} ⇄ ${bg.path}`,
            message: `border contrast ${r.toFixed(2)}:1 < 3:1 (${bd.value} on ${bg.value}) — fine if decorative; must pass when this border identifies the control`,
          });
        }
      }
    }
  }
  return pairs;
}

/* Dark-specific glare checks: pure #fff text or pure #000 surface in the dark theme. */
function glareCheck(darkTokens, findings) {
  for (const t of darkTokens) {
    const role = roleOf(t.path);
    const v = t.value.toLowerCase();
    if (role === "text" && (v === "#ffffff" || v === "#fff")) {
      findings.push({
        severity: "WARN",
        code: "DARK-GLARE-TEXT",
        theme: "dark",
        token: t.path,
        message: `pure #ffffff as dark-mode text glares — use the #E6E6E6 range (dark-mode §1)`,
      });
    }
    if (role === "surface" && (v === "#000000" || v === "#000")) {
      findings.push({
        severity: "WARN",
        code: "DARK-GLARE-SURFACE",
        theme: "dark",
        token: t.path,
        message: `pure #000000 as dark-mode surface flattens elevation — use the #121212 range (dark-mode §1)`,
      });
    }
  }
}

/* --------------------------------------------------------------- checking */

function check(tokensPath, darkPath, asJson) {
  const findings = [];
  let light, dark;
  try {
    light = JSON.parse(readFileSync(tokensPath, "utf8"));
  } catch (e) {
    console.error(`✗ cannot read ${tokensPath}: ${e.message}`);
    process.exit(2);
  }
  if (darkPath) {
    try {
      dark = JSON.parse(readFileSync(darkPath, "utf8"));
    } catch (e) {
      console.error(`✗ cannot read ${darkPath}: ${e.message}`);
      process.exit(2);
    }
  }

  const lightTokens = walkColors(light);
  const primitives = lightTokens.filter((t) => {
    const root = t.path.split(".")[0];
    return PRIMITIVE_ROOTS.test(root);
  });
  const semantic = lightTokens.filter((t) => !primitives.includes(t));

  /* --- parity diff vs dark file --- */
  let missing = 0, extra = 0, invariant = 0;
  if (dark) {
    const darkTokens = walkColors(dark);
    const darkMap = new Map(darkTokens.map((t) => [t.path, t.value]));
    for (const t of semantic) {
      if (!darkMap.has(t.path)) {
        missing++;
        findings.push({
          severity: "ERROR",
          code: "DARK-MISSING",
          theme: "dark",
          token: t.path,
          message: `semantic token has no dark override — the component using it keeps its light value in dark mode`,
        });
      } else if (darkMap.get(t.path).toLowerCase() === t.value.toLowerCase()) {
        const role = roleOf(t.path);
        if (role === "text" || role === "surface") {
          invariant++;
          findings.push({
            severity: "WARN",
            code: "DARK-INVARIANT",
            theme: "dark",
            token: t.path,
            message: `value identical in light and dark (${t.value}) — dark themes re-tune text/surface roles, near-always a bug (dark-mode §1)`,
          });
        }
      }
    }
    const lightMap = new Map(lightTokens.map((t) => [t.path, t.value]));
    for (const t of darkTokens) {
      const root = t.path.split(".")[0];
      if (PRIMITIVE_ROOTS.test(root)) continue;
      if (!lightMap.has(t.path)) {
        extra++;
        findings.push({
          severity: "WARN",
          code: "DARK-EXTRA",
          theme: "dark",
          token: t.path,
          message: `dark file defines a token the light file lacks — themes drift apart`,
        });
      }
    }
    glareCheck(darkTokens, findings);
  }

  /* --- contrast audit, both themes --- */
  const pairsLight = auditContrast(lightTokens, "light", findings);
  let pairsDark = 0;
  if (dark) pairsDark = auditContrast(walkColors(dark), "dark", findings);

  /* --- report --- */
  if (asJson) {
    console.log(JSON.stringify({
      file: tokensPath,
      dark: darkPath || null,
      counts: {
        colorTokens: lightTokens.length,
        primitives: primitives.length,
        semantic: semantic.length,
        pairsChecked: pairsLight + pairsDark,
        missingInDark: missing,
        extraInDark: extra,
        invariantWarnings: invariant,
        errors: findings.filter((f) => f.severity === "ERROR").length,
        warnings: findings.filter((f) => f.severity === "WARN").length,
      },
      findings,
    }, null, 2));
  } else {
    console.log(`\ntheme audit — ${tokensPath}${darkPath ? ` + ${darkPath}` : ""}`);
    console.log(`  color tokens: ${lightTokens.length} (${primitives.length} primitives, ${semantic.length} semantic)`);
    console.log(`  contrast pairs checked: light ${pairsLight}${dark ? ` · dark ${pairsDark}` : ""}`);
    if (dark) {
      console.log(`  dark parity: ${missing} missing · ${extra} extra · ${invariant} invariant`);
    }
    const errors = findings.filter((f) => f.severity === "ERROR");
    const warns = findings.filter((f) => f.severity === "WARN");
    for (const f of errors) console.log(`  ✗ [${f.code}] ${f.token} — ${f.message}`);
    for (const f of warns) console.log(`  ! [${f.code}] ${f.token} — ${f.message}`);
    console.log(
      errors.length
        ? `\n  ${errors.length} error(s), ${warns.length} warning(s) — fix errors before shipping.`
        : `\n  ✓ clean — ${warns.length} warning(s), no errors.`
    );
  }
  process.exit(findings.some((f) => f.severity === "ERROR") ? 1 : 0);
}

/* ------------------------------------------------------------------- boot */

function boot() {
  console.log(`<!-- 1) meta: put inside <head>, before the stylesheet -->
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121212" media="(prefers-color-scheme: dark)">

<!-- 2) no-flash boot: inline + blocking, in <head>, BEFORE the stylesheet.
     This is the ONE sanctioned exception to the web-vitals render-blocking
     rule (dark-mode §4): it must run before first paint or the wrong theme
     flashes for one frame on every reload. It is ~200 bytes and never blocks
     on network. -->
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

<!-- 3) CSS: components only ever see semantic variables. -->
<style>
  :root { color-scheme: light dark; }
  :root, [data-theme="light"] {
    color-scheme: light;
    --color-surface: #ffffff;
    --color-text: #1a1c1e;
  }
  [data-theme="dark"] {
    color-scheme: dark;
    --color-surface: #121212;
    --color-text: #e6e6e6;
  }
</style>

<!-- 4) three-mode toggle (light / dark / system) — the button cycles and
     persists "system" as null so prefers-color-scheme wins again. -->
<script>
function cycleTheme(btn) {
  var root = document.documentElement;
  var order = ["light", "dark", "system"];
  var cur = localStorage.getItem("theme") || "system";
  var next = order[(order.indexOf(cur) + 1) % order.length];
  if (next === "system") {
    localStorage.removeItem("theme");
    root.dataset.theme =
      matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } else {
    localStorage.setItem("theme", next);
    root.dataset.theme = next;
  }
  // announce for screen readers; aria-live region in the page markup
  var live = document.getElementById("theme-status");
  if (live) live.textContent = "Theme: " + next;
}
</script>`);
}

/* -------------------------------------------------------------- self-test */

function selfTest() {
  const badLight = {
    color: {
      surface: { $type: "color", $value: "#ffffff" },
      "surface-muted": { $type: "color", $value: "#f5f5f5" },
      text: { $type: "color", $value: "#111827" },
      "text-muted": { $type: "color", $value: "#374151" }, // will fail on dark bg
      border: { $type: "color", $value: "#d1d5db" },
    },
    primitives: { gray: { 100: { $type: "color", $value: "#f3f4f6" } } },
  };
  const badDark = {
    color: {
      surface: { $type: "color", $value: "#000000" }, // glare
      // "surface-muted" and "border" missing → DARK-MISSING
      text: { $type: "color", $value: "#ffffff" }, // glare
      "text-muted": { $type: "color", $value: "#374151" }, // invariant + fails on #000
    },
    primitives: { gray: { 100: { $type: "color", $value: "#f3f4f6" } } },
  };

  const goodLight = {
    color: {
      surface: { $type: "color", $value: "#ffffff" },
      "surface-muted": { $type: "color", $value: "#f5f5f5" },
      text: { $type: "color", $value: "#111827" },
      "text-muted": { $type: "color", $value: "#4b5563" },
      border: { $type: "color", $value: "#9ca3af" },
    },
    primitives: { gray: { 100: { $type: "color", $value: "#f3f4f6" } } },
  };
  const goodDark = {
    color: {
      surface: { $type: "color", $value: "#121212" },
      "surface-muted": { $type: "color", $value: "#1e1e1e" },
      text: { $type: "color", $value: "#e6e6e6" },
      "text-muted": { $type: "color", $value: "#a8a8a8" },
      border: { $type: "color", $value: "#5a5a5a" },
    },
    primitives: { gray: { 100: { $type: "color", $value: "#f3f4f6" } } },
  };

  let ok = true;
  const expect = (cond, label) => {
    console.log(`  ${cond ? "✓" : "✗"} ${label}`);
    if (!cond) ok = false;
  };

  const lt = walkColors(badLight);
  const dt = walkColors(badDark);
  const prim = lt.filter((t) => PRIMITIVE_ROOTS.test(t.path.split(".")[0]));
  const sem = lt.filter((t) => !prim.includes(t));

  // parity: dark file lacks surface-muted + border
  const darkMap = new Map(dt.map((t) => [t.path, t.value]));
  const missing = sem.filter((t) => !darkMap.has(t.path));
  expect(missing.length === 2, `parity: 2 missing dark overrides (got ${missing.length})`);

  // glare: dark text #ffffff + surface #000000
  const glare = [];
  glareCheck(dt, glare);
  expect(glare.length === 2, `glare: 2 warnings on bad dark (got ${glare.length})`);

  // invariant: text-muted identical in both
  const inv = sem.filter(
    (t) => darkMap.has(t.path) && darkMap.get(t.path).toLowerCase() === t.value.toLowerCase()
  );
  expect(inv.length === 1, `invariant: 1 unchanged value (got ${inv.length})`);

  // contrast: bad pair text-muted (#374151) on surface (#000000) in dark < 4.5
  const errs = [];
  auditContrast(dt, "dark", errs);
  expect(
    errs.some((f) => f.code === "CONTRAST-TEXT" && f.token.includes("text-muted")),
    `contrast: dark text-muted pair flagged as ERROR`
  );

  // scope isolation: primitives pair must NOT be audited against color.surface
  const lightErrs = [];
  auditContrast(lt, "light", lightErrs);
  expect(
    !lightErrs.some((f) => f.token.includes("gray.100")),
    `scope: primitive gray.100 never paired across scopes`
  );

  // good fixtures → 0 ERROR
  const goodFindings = [];
  const gt = walkColors(goodLight);
  const gdt = walkColors(goodDark);
  glareCheck(gdt, goodFindings);
  auditContrast(gt, "light", goodFindings);
  auditContrast(gdt, "dark", goodFindings);
  const gErr = goodFindings.filter((f) => f.severity === "ERROR");
  expect(gErr.length === 0, `good fixture: 0 errors (got ${gErr.length})`);
  expect(goodFindings.filter((f) => f.code === "DARK-GLARE-TEXT").length === 0, `good fixture: no glare`);

  console.log(ok ? "self-test: PASS" : "self-test: FAIL");
  process.exit(ok ? 0 : 1);
}

/* -------------------------------------------------------------------- cli */

const args = process.argv.slice(2);
if (args.includes("--self-test")) {
  selfTest();
} else if (args.includes("--boot")) {
  boot();
} else {
  const tokensIdx = args.indexOf("--tokens");
  const darkIdx = args.indexOf("--dark");
  if (tokensIdx === -1) {
    console.error("usage: theme.mjs --tokens light.json [--dark dark.json] [--json] | --boot | --self-test");
    process.exit(2);
  }
  check(args[tokensIdx + 1], darkIdx !== -1 ? args[darkIdx + 1] : null, args.includes("--json"));
}
