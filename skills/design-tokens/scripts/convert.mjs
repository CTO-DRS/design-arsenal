#!/usr/bin/env node
/**
 * convert.mjs — DTCG design-token converter for design-arsenal (tokens module).
 * Zero dependencies. Node 18+.
 *
 * Usage:
 *   node convert.mjs <tokens.json> --to css|tailwind3|tailwind4|figma  [> out]
 *   node convert.mjs --self-test
 *
 * Reads W3C DTCG-format token files ($value/$type, {references}), resolves
 * references, and emits:
 *   css       :root { --kebab-path: value; }               (all tokens)
 *   tailwind3 : module.exports theme.extend map            (namespaced)
 *   tailwind4 : @theme { --color-*: …; }                   (v4 namespaces)
 *   figma     : resolved grouped JSON (Variables-ready)
 *
 * Exit codes: 0 ok · 1 self-test fail / unresolved refs · 2 usage error.
 */
import { readFileSync } from "node:fs";

// ---------- parse + resolve ----------
function flatten(node, path = [], inheritedType = null, out = []) {
  if (node === null || typeof node !== "object") return out;
  if ("$value" in node) {
    out.push({
      path,
      type: node.$type ?? inheritedType ?? "color",
      value: node.$value,
      desc: node.$description ?? null,
    });
    return out;
  }
  const nextType = typeof node.$type === "string" ? node.$type : inheritedType;
  for (const [k, v] of Object.entries(node)) {
    if (k === "$type" || k === "$description") continue;
    flatten(v, [...path, k], nextType, out);
  }
  return out;
}

function resolveAll(tokens) {
  const map = new Map(tokens.map((t) => [t.path.join("."), t]));
  const resolve = (value, depth = 0) => {
    if (depth > 20 || typeof value !== "string") return value;
    const m = value.match(/^\{(.+)\}$/);
    if (!m) return value;
    if (!map.has(m[1])) throw new Error(`unresolved reference: {${m[1]}}`);
    return resolve(map.get(m[1]).value, depth + 1);
  };
  for (const t of tokens) t.value = resolve(t.value);
  return tokens;
}

const kebab = (parts) => parts.join("-");

// ---------- exporters ----------
function toCss(tokens) {
  const lines = tokens.map((t) => `  --${kebab(t.path)}: ${t.value};`);
  return `:root {\n${lines.join("\n")}\n}\n`;
}

const TW3 = {
  color: (rest) => ({ ns: "colors", key: rest.join("-") }),
  space: (rest) => ({ ns: "spacing", key: rest.join("-") }),
  radius: (rest) => ({ ns: "borderRadius", key: rest.join("-") }),
  font: (rest) => {
    if (rest[0] === "size") return { ns: "fontSize", key: rest.slice(1).join("-") };
    if (rest[0] === "family") return { ns: "fontFamily", key: rest.slice(1).join("-") };
    if (rest[0] === "weight") return { ns: "fontWeight", key: rest.slice(1).join("-") };
    return null;
  },
  shadow: (rest) => ({ ns: "boxShadow", key: rest.join("-") }),
  duration: (rest) => ({ ns: "transitionDuration", key: rest.join("-") }),
  ease: (rest) => ({ ns: "transitionTimingFunction", key: rest.join("-") }),
};

function toTailwind3(tokens) {
  const buckets = new Map();
  for (const t of tokens) {
    const [head, ...rest] = t.path;
    const rule = TW3[head]?.(rest);
    const ns = rule?.ns ?? "extend";
    const key = rule?.key ?? kebab(t.path);
    if (!buckets.has(ns)) buckets.set(ns, new Map());
    buckets.get(ns).set(key, t.value);
  }
  const out = ["/** generated from tokens — do not hand-edit */", "module.exports = {", "  theme: {", "    extend: {"];
  for (const [ns, entries] of buckets) {
    out.push(`      ${ns}: {`);
    for (const [k, v] of entries) out.push(`        '${k}': ${JSON.stringify(v)},`);
    out.push("      },");
  }
  out.push("    },", "  },", "};");
  return out.join("\n") + "\n";
}

const TW4 = {
  color: (rest) => `--color-${kebab(rest)}`,
  space: (rest) => `--spacing-${kebab(rest)}`,
  radius: (rest) => `--radius-${kebab(rest)}`,
  font: (rest) => {
    if (rest[0] === "size") return `--text-${kebab(rest.slice(1))}`;
    if (rest[0] === "family") return `--font-${kebab(rest.slice(1))}`;
    if (rest[0] === "weight") return `--font-weight-${kebab(rest.slice(1))}`;
    return null;
  },
  shadow: (rest) => `--shadow-${kebab(rest)}`,
  duration: (rest) => `--duration-${kebab(rest)}`,
  ease: (rest) => `--ease-${kebab(rest)}`,
};

function toTailwind4(tokens) {
  const lines = [];
  for (const t of tokens) {
    const [head, ...rest] = t.path;
    const v = TW4[head]?.(rest) ?? `--tk-${kebab(t.path)}`;
    lines.push(`  ${v}: ${t.value};`);
  }
  return `@theme {\n${lines.join("\n")}\n}\n`;
}

function toFigma(tokens) {
  const root = {};
  for (const t of tokens) {
    let node = root;
    for (const seg of t.path) {
      node[seg] ??= {};
      node = node[seg];
    }
    node.$type = t.type;
    node.$value = t.value;
    if (t.desc) node.$description = t.desc;
  }
  return JSON.stringify(root, null, 2) + "\n";
}

const EXPORTERS = { css: toCss, tailwind3: toTailwind3, tailwind4: toTailwind4, figma: toFigma };

// ---------- self-test ----------
function selfTest() {
  const sample = {
    color: {
      blue: { 500: { $type: "color", $value: "#3B82F6" } },
      bg: { $type: "color", $value: "{color.gray.950}" },
      fg: { $type: "color", $value: "{color.gray.100}" },
      gray: { 100: { $type: "color", "$value": "#F3F4F6" }, 950: { $type: "color", $value: "#030712" } },
    },
    space: { 4: { $type: "dimension", $value: "16px" } },
    font: { size: { 3: { $type: "dimension", $value: "20px" } } },
    radius: { md: { $type: "dimension", $value: "12px" } },
    duration: { fast: { $type: "duration", $value: "150ms" } },
  };
  const tokens = resolveAll(flatten(sample));
  const get = (name) => tokens.find((t) => t.path.join(".") === name)?.value;
  const checks = [
    ["reference resolved (bg)", get("color.bg") === "#030712"],
    ["reference resolved (fg)", get("color.fg") === "#F3F4F6"],
    ["css export", toCss(tokens).includes("--color-blue-500: #3B82F6;")],
    ["css export (dimension)", toCss(tokens).includes("--space-4: 16px;")],
    ["tailwind3 colors", toTailwind3(tokens).includes("'blue-500': \"#3B82F6\"")],
    ["tailwind3 spacing", toTailwind3(tokens).includes("'4': \"16px\"")],
    ["tailwind4 namespace", toTailwind4(tokens).includes("--color-blue-500: #3B82F6;")],
    ["tailwind4 text size", toTailwind4(tokens).includes("--text-3: 20px;")],
    ["figma round-trip", JSON.parse(toFigma(tokens)).color.blue["500"].$value === "#3B82F6"],
  ];
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`${pass ? "✓" : "✗"} ${label}`);
    if (!pass) ok = false;
  }
  console.log(ok ? "self-test: PASS" : "self-test: FAIL");
  process.exit(ok ? 0 : 1);
}

// ---------- main ----------
const argv = process.argv.slice(2);
if (argv.includes("--self-test")) selfTest();

if (argv.includes("-h") || argv.includes("--help")) {
  console.error("usage: convert.mjs <tokens.json> --to css|tailwind3|tailwind4|figma\n       convert.mjs --self-test");
  process.exit(2);
}

const file = argv[0];
const toIdx = argv.indexOf("--to");
const target = toIdx >= 0 ? argv[toIdx + 1] : null;

if (!file || !target || !EXPORTERS[target]) {
  console.error("usage: convert.mjs <tokens.json> --to css|tailwind3|tailwind4|figma\n       convert.mjs --self-test");
  process.exit(2);
}

let tokens;
try {
  tokens = resolveAll(flatten(JSON.parse(readFileSync(file, "utf8"))));
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}

if (tokens.length === 0) {
  console.error("✗ no tokens found (expected DTCG $value leaves)");
  process.exit(1);
}

process.stdout.write(EXPORTERS[target](tokens));
