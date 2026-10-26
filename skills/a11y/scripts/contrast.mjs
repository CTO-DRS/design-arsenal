#!/usr/bin/env node
/**
 * contrast.mjs — WCAG contrast checker for design-arsenal (a11y module).
 * Zero dependencies. Node 18+.
 *
 * Usage:
 *   node contrast.mjs "#767676" "#ffffff"       one pair → ratio + AA/AAA verdicts
 *   node contrast.mjs --tokens tokens.json      audit a DTCG token file
 *   node contrast.mjs --tokens tokens.json --pairs "fg/bg,fg.muted/bg.subtle"
 *   node contrast.mjs --self-test               verify the math, exit 0/1
 *
 * Token pairing heuristic (no --pairs given): flattened token paths are matched
 * by role — a path containing fg | text | foreground | content | on-* is a
 * foreground; a path containing bg | surface | background is a background.
 * Pairs are formed within the same scope (the shared parent path minus the role
 * segment). Tokens named like "fg" inside "color.light.*" pair with "bg" in the
 * same scope, so light/dark themes audit independently. Explicit --pairs always
 * wins (dot-path names, "fg/bg" or "fg:bg" comma-separated).
 *
 * Exit codes: 0 all pass · 1 failures found · 2 usage/parse error.
 */
import { readFileSync } from "node:fs";

// ---------- color math ----------
const clamp01 = (x) => Math.min(1, Math.max(0, x));

function parseColor(input) {
  let s = String(input).trim().toLowerCase();
  // DTCG 8-digit hex or rgba() strings are tolerated
  if (s.startsWith("#")) {
    s = s.slice(1);
    if (s.length === 3 || s.length === 4) s = [...s].map((c) => c + c).join("");
    if (s.length === 8) s = s.slice(0, 6); // alpha ignored for contrast
    if (s.length !== 6 || /[^0-9a-f]/.test(s)) return null;
    return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).slice(0, 3).map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    return parts;
  }
  return null;
}

function relLuminance([r, g, b]) {
  const lin = (v) => {
    const c = clamp01(v / 255);
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(fg, bg) {
  const a = parseColor(fg);
  const b = parseColor(bg);
  if (!a || !b) return null;
  const l1 = relLuminance(a);
  const l2 = relLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const fmt = (r) => (r === null ? "n/a" : `${r.toFixed(2)}:1`);
const verdicts = (r) =>
  r === null
    ? "unparseable colour"
    : [
        r >= 7 ? "AAA body ✓" : "AAA body ✗",
        r >= 4.5 ? "AA body ✓" : "AA body ✗",
        r >= 3 ? "AA large/UI ✓" : "AA large/UI ✗",
      ].join(" · ");

// ---------- DTCG flattening ----------
function flatten(node, path = [], out = []) {
  if (node === null || typeof node !== "object") return out;
  if ("$value" in node) {
    out.push({ path, type: node.$type ?? "color", value: node.$value });
    return out;
  }
  for (const [k, v] of Object.entries(node)) flatten(v, [...path, k], out);
  return out;
}

const FG = /(?:^|[-_.])(fg|foreground|text|content)(?:$|[-_.A-Z0-9])|^(?:on)(?:$|[-_.A-Z0-9])/i;
const BG = /(?:^|[-_.])(bg|surface|background)(?:$|[-_.A-Z0-9])/i;

function firstRole(path, re) {
  for (let i = 0; i < path.length; i++) {
    if (re.test(path[i])) return i;
  }
  return -1;
}

function autoPairs(tokens) {
  const colors = tokens.filter((t) => t.type === "color" || /^#|rgba?\(/.test(String(t.value)));
  const fgs = [];
  const bgs = [];
  for (const t of colors) {
    const fi = firstRole(t.path, FG);
    const bi = firstRole(t.path, BG);
    if (fi >= 0 && bi >= 0) continue; // ambiguous name — skip
    if (fi >= 0) fgs.push({ t, scope: t.path.slice(0, fi).join(".") });
    else if (bi >= 0) bgs.push({ t, scope: t.path.slice(0, bi).join(".") });
  }
  const pairs = [];
  for (const f of fgs) {
    // same scope, else the shallowest-scope background (root-ish fallback)
    let best = bgs.find((b) => b.scope === f.scope);
    if (!best && bgs.length) {
      best = bgs.reduce((a, b) => (b.scope.split(".").length < a.scope.split(".").length ? b : a));
    }
    if (best) pairs.push([f.t, best.t]);
  }
  return pairs;
}

function dotted(tokens) {
  const map = new Map();
  for (const t of tokens) map.set(t.path.join("."), t);
  return map;
}

function resolveRef(map, value, depth = 0) {
  if (depth > 10 || typeof value !== "string") return value;
  const m = value.match(/^\{(.+)\}$/);
  if (!m) return value;
  const ref = map.get(m[1]);
  return ref ? resolveRef(map, ref.value, depth + 1) : null;
}

// ---------- self test ----------
function selfTest() {
  const cases = [
    ["#000000", "#ffffff", 21],
    ["#767676", "#ffffff", 4.54],
    ["#777777", "#ffffff", 4.48],
    ["#ffffff", "#767676", 4.54],
    ["rgb(0,0,0)", "#FFF", 21],
  ];
  let ok = true;
  for (const [a, b, expected] of cases) {
    const r = contrastRatio(a, b);
    const pass = r !== null && Math.abs(r - expected) < 0.02;
    console.log(`${pass ? "✓" : "✗"} ${a} vs ${b} → ${fmt(r)} (expected ${expected}:1)`);
    if (!pass) ok = false;
  }
  console.log(ok ? "self-test: PASS" : "self-test: FAIL");
  process.exit(ok ? 0 : 1);
}

// ---------- main ----------
const argv = process.argv.slice(2);
if (argv.includes("--self-test")) selfTest();

const usage = () => {
  console.error("usage: contrast.mjs <fgHex> <bgHex>\n       contrast.mjs --tokens <file.json> [--pairs \"a/b,c/d\"]\n       contrast.mjs --self-test");
  process.exit(2);
};

if (argv.includes("-h") || argv.includes("--help") || argv.length === 0) usage();

if (argv.includes("--tokens")) {
  const file = argv[argv.indexOf("--tokens") + 1];
  if (!file) usage();
  let json;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`✗ cannot parse ${file}: ${e.message}`);
    process.exit(2);
  }
  const tokens = flatten(json);
  const map = dotted(tokens);
  const list = [];
  for (const t of tokens) list.push({ ...t, value: resolveRef(map, t.value) ?? t.value });

  let pairs = [];
  const explicit = argv.includes("--pairs") ? argv[argv.indexOf("--pairs") + 1] : null;
  if (explicit) {
    for (const spec of explicit.split(",").map((s) => s.trim()).filter(Boolean)) {
      const [f, b] = spec.split(/[/:]/).map((s) => s.trim());
      const ft = list.find((t) => t.path.join(".") === f);
      const bt = list.find((t) => t.path.join(".") === b);
      if (!ft || !bt) {
        console.error(`✗ pair "${spec}": token not found (have: ${[...map.keys()].join(", ")})`);
        process.exit(2);
      }
      pairs.push([ft, bt]);
    }
  } else {
    pairs = autoPairs(list);
    if (pairs.length === 0) {
      console.error("✗ no fg/bg pairs detected. Name tokens …fg/…bg (or …text/…surface) or pass --pairs.");
      process.exit(2);
    }
  }

  let fails = 0;
  console.log(`auditing ${pairs.length} pair${pairs.length === 1 ? "" : "s"} (AA body = 4.5:1, AA large/UI = 3:1)\n`);
  for (const [f, b] of pairs) {
    const r = contrastRatio(f.value, b.value);
    const pass = r !== null && r >= 4.5;
    const ui = r !== null && r >= 3;
    if (!pass) fails++;
    console.log(`${pass ? "✓" : "✗"} ${f.path.join(".")} (${f.value}) on ${b.path.join(".")} (${b.value}) → ${fmt(r)}  [${verdicts(r)}]${!pass && ui ? "  ⚠ UI-only pass" : ""}`);
  }
  console.log(`\n${fails === 0 ? "✓ all pairs pass AA body" : `✗ ${fails} pair${fails === 1 ? "" : "s"} below 4.5:1 — fix before shipping`}`);
  process.exit(fails === 0 ? 0 : 1);
}

// two-colour mode
const [fg, bg] = argv;
const r = contrastRatio(fg, bg);
if (r === null) usage();
console.log(`${fg} on ${bg} → ${fmt(r)}  [${verdicts(r)}]`);
process.exit(r >= 4.5 ? 0 : 1);
