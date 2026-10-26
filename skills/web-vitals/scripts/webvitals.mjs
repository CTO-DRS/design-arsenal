#!/usr/bin/env node
/**
 * webvitals.mjs — static Core Web Vitals linter for design-arsenal (web-vitals module).
 * Zero dependencies. Node 18+.
 *
 * Usage:
 *   node webvitals.mjs page.html               audit one HTML file (text report)
 *   node webvitals.mjs page.html other.html    audit several files
 *   node webvitals.mjs src/                    audit every .html/.htm in a dir (depth 1)
 *   node webvitals.mjs src/ --json             machine-readable findings
 *   node webvitals.mjs --self-test             embedded fixtures, exit 0/1
 *
 * What it catches (static, structural — not a runtime profiler):
 *   CLS  IMG-DIMS / IFRAME-DIMS   media without width+height attributes
 *   CLS  FONT-DISPLAY             @font-face blocks missing font-display
 *   LCP  LAZY-HERO                loading="lazy" on the first <img> (likeliest LCP)
 *   LCP  LAZY-FOLD                lazy on <img> #2–#3 — verify they're below the fold
 *   LCP  HERO-PRIORITY            first <img> without fetchpriority="high" (info)
 *   LCP  BLOCKING-SCRIPT          classic <script src> in <head> without defer/async
 *   LCP  PNG-HERO                 hero image shipped as .png (AVIF/WebP instead)
 *   LCP  FONT-PRECONNECT          Google Fonts stylesheet without fonts.gstatic preconnect
 *   INP  INLINE-HANDLER           inline onclick="..." attributes (main-thread hot path)
 *   INP  DOC-WRITE                document.write() usage
 *   MOBILE VIEWPORT               missing <meta name="viewport">
 *
 * Exit codes: 0 no HIGH findings · 1 HIGH findings present · 2 usage/parse error.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";

// ---------- tiny ANSI helpers ----------
const tty = process.stdout.isTTY;
const C = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const cyan = (s) => C("36", s), red = (s) => C("31", s), yellow = (s) => C("33", s);
const dim = (s) => C("2", s), bold = (s) => C("1", s), green = (s) => C("32", s);

// ---------- HTML preparation ----------
// Blank out comments and <script>/<style> bodies while preserving every newline,
// so match indexes and line numbers stay faithful to the original file.
function blankRegion(src, startIdx, endIdx) {
  const region = src.slice(startIdx, endIdx);
  return (
    src.slice(0, startIdx) +
    region.replace(/[^\n]/g, " ") +
    src.slice(endIdx)
  );
}

function prepare(raw) {
  const scriptBodies = [];
  const styleBodies = [];
  let doc = raw.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));

  doc = doc.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi, (m, open, body, close) => {
    scriptBodies.push(body);
    return open + body.replace(/[^\n]/g, " ") + close;
  });
  doc = doc.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi, (m, open, body, close) => {
    styleBodies.push(body);
    return open + body.replace(/[^\n]/g, " ") + close;
  });
  return { doc, scriptBodies, styleBodies };
}

const lineOf = (doc, idx) => doc.slice(0, idx).split("\n").length;
const hasAttr = (tag, name) => new RegExp(`(?:^|\\s)${name}\\s*=`, "i").test(tag);

// ---------- checks ----------
function auditFile(raw) {
  const { doc, scriptBodies, styleBodies } = prepare(raw);
  const findings = [];
  const add = (id, metric, severity, message, fix, lines) =>
    findings.push({ id, metric, severity, message, fix, lines });

  const head = (() => {
    const m = doc.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i);
    return m ? { body: m[1], offset: m.index + m[0].indexOf(m[1]) } : { body: "", offset: 0 };
  })();
  const allImgs = [...doc.matchAll(/<img\b[^>]*>/gi)];

  // --- CLS: media dimensions ---
  const imgNoDims = allImgs.filter((m) => !hasAttr(m[0], "width") || !hasAttr(m[0], "height"));
  if (imgNoDims.length)
    add("IMG-DIMS", "CLS", "high",
      `${imgNoDims.length} <img> without width+height attributes`,
      "add width/height attributes (or CSS aspect-ratio) so the browser reserves the box before the image loads",
      imgNoDims.slice(0, 3).map((m) => lineOf(doc, m.index)));

  const iframes = [...doc.matchAll(/<iframe\b[^>]*>/gi)];
  const ifrNoDims = iframes.filter((m) => !hasAttr(m[0], "width") || !hasAttr(m[0], "height"));
  if (ifrNoDims.length)
    add("IFRAME-DIMS", "CLS", "medium",
      `${ifrNoDims.length} <iframe> without width+height attributes`,
      "add width/height (or wrap in a fixed-aspect container) — embeds are the classic late shift",
      ifrNoDims.slice(0, 3).map((m) => lineOf(doc, m.index)));

  // --- CLS/LCP: font-display ---
  const faces = [];
  for (const style of styleBodies)
    for (const m of style.matchAll(/@font-face\s*{[^}]*}/gi))
      if (!/font-display/i.test(m[0]))
        faces.push(m);
  if (faces.length)
    add("FONT-DISPLAY", "CLS", "medium",
      `${faces.length} @font-face block(s) missing font-display`,
      "add font-display: swap (+ metric-matched fallback via size-adjust) — invisible-text and swap reflow both hurt",
      []);

  // --- LCP: lazy hero (two tiers — first img is the likeliest LCP candidate) ---
  const lazyOf = (m) => /\sloading\s*=\s*["']?lazy/i.test(m[0]);
  const firstLazy = allImgs[0] && lazyOf(allImgs[0]) ? [allImgs[0]] : [];
  if (firstLazy.length)
    add("LAZY-HERO", "LCP", "high",
      "the first <img> in the document uses loading=\"lazy\" — the likeliest LCP element is deferred until after layout",
      "above-the-fold images must be eager (omit loading) with fetchpriority=\"high\"; keep lazy only below the fold",
      [lineOf(doc, firstLazy[0].index)]);
  const lazyAfter = allImgs.slice(1, 3).filter(lazyOf);
  if (lazyAfter.length)
    add("LAZY-FOLD", "LCP", "medium",
      `${lazyAfter.length} of <img> #2–#3 use loading="lazy"`,
      "correct if genuinely below the fold — if they render in the first viewport, make them eager + fetchpriority=\"high\"",
      lazyAfter.slice(0, 3).map((m) => lineOf(doc, m.index)));

  // --- LCP: hero priority (info) ---
  if (allImgs.length && !/\sfetchpriority\s*=\s*["']?high/i.test(allImgs[0][0]))
    add("HERO-PRIORITY", "LCP", "info",
      "first <img> lacks fetchpriority=\"high\"",
      "if this image is the LCP element, set fetchpriority=\"high\" so it wins the bandwidth race",
      [lineOf(doc, allImgs[0].index)]);

  // --- LCP: render-blocking head scripts ---
  const blocking = [];
  for (const m of head.body.matchAll(/<script\b[^>]*>/gi)) {
    const tag = m[0];
    if (/\stype\s*=\s*["']?(?:module|application\/(?:ld\+)?json|importmap|speculationrules)/i.test(tag)) continue;
    if (/\s(?:defer|async)\s*(?:=|\s|\/?>)/i.test(tag)) continue;
    blocking.push(tag);
  }
  if (blocking.length) {
    const withSrc = blocking.filter((t) => /\ssrc\s*=/i.test(t));
    add("BLOCKING-SCRIPT", "LCP", "high",
      `${blocking.length} render-blocking <script> in <head>${withSrc.length ? ` (${withSrc.length} with src)` : " (inline)"}`,
      withSrc.length
        ? "add defer (or async) to external head scripts, or move them before </body>"
        : "inline head scripts block parsing — move them to the end of <body> or behind defer",
      [lineOf(doc, head.offset)]);
  }

  // --- LCP: PNG hero ---
  const pngHero = allImgs.slice(0, 2).filter((m) => /\ssrc\s*=\s*["']?[^"'>\s]+\.png(?:[?#]|["'>\s]|$)/i.test(m[0]));
  if (pngHero.length)
    add("PNG-HERO", "LCP", "medium",
      `${pngHero.length} of the first 2 <img> tags ship .png`,
      "serve AVIF or WebP for photographic/hero content (PNG only for logos/icons needing transparency-sharp edges)",
      pngHero.slice(0, 3).map((m) => lineOf(doc, m.index)));

  // --- LCP: font origin preconnect ---
  const gfonts = /<link\b[^>]*rel\s*=\s*["']?stylesheet["']?[^>]*href\s*=\s*["']?[^"'>]*fonts\.googleapis\.com/i.test(head.body)
    || /<link\b[^>]*href\s*=\s*["']?[^"'>]*fonts\.googleapis\.com[^>]*rel\s*=\s*["']?stylesheet/i.test(head.body);
  const preconnected = /<link\b[^>]*rel\s*=\s*["']?preconnect["']?[^>]*href\s*=\s*["']?[^"'>]*fonts\.gstatic\.com/i.test(head.body);
  if (gfonts && !preconnected)
    add("FONT-PRECONNECT", "LCP", "info",
      "Google Fonts stylesheet without preconnect to fonts.gstatic.com",
      "add <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin> before the stylesheet",
      [lineOf(doc, head.offset)]);

  // --- INP: inline handlers ---
  const inlineHandlers = [...doc.matchAll(/<[a-zA-Z][^>]*\sonclick\s*=/gi)];
  if (inlineHandlers.length)
    add("INLINE-HANDLER", "INP", "medium",
      `${inlineHandlers.length} inline onclick= attribute(s)`,
      "bind listeners in JS instead — inline handlers invite heavy synchronous work on the main thread (and fight CSP)",
      inlineHandlers.slice(0, 3).map((m) => lineOf(doc, m.index)));

  // --- INP: document.write ---
  const docWrite = scriptBodies.filter((b) => /document\.write\s*\(/.test(b)).length
    + (doc.match(/document\.write\s*\(/g) || []).length;
  if (docWrite)
    add("DOC-WRITE", "INP", "high",
      `document.write() used ${docWrite}×`,
      "remove it — parser-blocking and deprecated by browsers; inject nodes or append script elements instead",
      []);

  // --- MOBILE: viewport ---
  if (!/<meta\b[^>]*name\s*=\s*["']?viewport/i.test(head.body))
    add("VIEWPORT", "MOBILE", "medium",
      "no <meta name=\"viewport\"> in <head>",
      "add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> — without it mobile rendering lies about every other metric",
      [lineOf(doc, head.offset)]);

  return findings;
}

// ---------- reporting ----------
const SEV_ORDER = { high: 0, medium: 1, info: 2 };
const ICON = { high: "✗", medium: "!", info: "·" };
const COLOR = { high: red, medium: yellow, info: dim };

function reportText(file, findings) {
  const lines = [];
  const high = findings.filter((f) => f.severity === "high").length;
  const med = findings.filter((f) => f.severity === "medium").length;
  const info = findings.length - high - med;
  lines.push(bold(`\n${file}`));
  if (!findings.length) {
    lines.push(green("  ✓ no structural vitals killers found (static)"));
  } else {
    for (const f of [...findings].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])) {
      const where = f.lines.length ? dim(` (line${f.lines.length > 1 ? "s" : ""} ${f.lines.join(", ")})`) : "";
      lines.push(`  ${COLOR[f.severity](ICON[f.severity] + " [" + f.metric + "]")} ${f.message}${where}`);
      lines.push(`    ${dim("→ " + f.fix)}`);
    }
  }
  lines.push(dim(`  ${high} high · ${med} medium · ${info} info`));
  const verdict = high ? red("FAIL") : med ? yellow("WARN") : green("PASS");
  lines.push(`  ${bold("verdict:")} ${verdict}${high ? red("  (HIGH findings block shipping — §9 audit)") : ""}`);
  return lines.join("\n");
}

function collectFiles(paths) {
  const out = [];
  for (const p of paths) {
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const f of readdirSync(p).sort()) {
        if ([".html", ".htm"].includes(extname(f).toLowerCase())) out.push(join(p, f));
      }
    } else out.push(p);
  }
  return out;
}

// ---------- self-test ----------
function selfTest() {
  const bad = `<!doctype html>
<html>
<head>
  <title>bad</title>
  <script src="/analytics.js"></script>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
  <style>@font-face { font-family: X; src: url(x.woff2); }</style>
</head>
<body>
  <img src="hero.png" loading="lazy" alt="hero">
  <img src="thumb.jpg" width="320" height="180" alt="t">
  <iframe src="https://example.com/embed"></iframe>
  <button onclick="doWork()">go</button>
  <script>document.write('<b>hi</b>');</script>
</body>
</html>`;
  const good = `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>good</title>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
  <style>@font-face { font-family: X; src: url(x.woff2); font-display: swap; }</style>
  <script src="/app.js" defer></script>
</head>
<body>
  <img src="hero.avif" width="1200" height="600" fetchpriority="high" alt="hero">
  <img src="late.webp" width="320" height="180" loading="lazy" alt="t">
  <script type="module">init();</script>
</body>
</html>`;

  const expectBad = ["IMG-DIMS", "IFRAME-DIMS", "FONT-DISPLAY", "LAZY-HERO", "HERO-PRIORITY",
    "BLOCKING-SCRIPT", "PNG-HERO", "FONT-PRECONNECT", "INLINE-HANDLER", "DOC-WRITE", "VIEWPORT"];
  const badFindings = auditFile(bad);
  const badIds = new Set(badFindings.map((f) => f.id));
  const missing = expectBad.filter((id) => !badIds.has(id));
  if (missing.length) {
    console.error(red(`self-test FAIL — expected findings missing: ${missing.join(", ")}`));
    console.error(badFindings.map((f) => `  got: ${f.id} ${f.message}`).join("\n"));
    return false;
  }
  const imgDims = badFindings.find((f) => f.id === "IMG-DIMS");
  if (!/1 <img>/.test(imgDims.message)) {
    console.error(red("self-test FAIL — IMG-DIMS must count only the dimensionless image (got: " + imgDims.message + ")"));
    return false;
  }
  const badHigh = badFindings.filter((f) => f.severity === "high").length;
  if (badHigh < 4) {
    console.error(red(`self-test FAIL — bad fixture should have ≥4 high findings, got ${badHigh}`));
    return false;
  }

  const goodFindings = auditFile(good);
  const goodHigh = goodFindings.filter((f) => f.severity === "high");
  if (goodHigh.length) {
    console.error(red("self-test FAIL — clean fixture produced HIGH findings:"));
    console.error(goodHigh.map((f) => `  ${f.id}: ${f.message}`).join("\n"));
    return false;
  }
  const lazies = goodFindings.filter((f) => f.id === "LAZY-HERO" || f.id === "PNG-HERO" || f.id === "FONT-DISPLAY");
  if (lazies.length) {
    console.error(red("self-test FAIL — clean fixture must not trigger lazy/png/font checks:"));
    console.error(lazies.map((f) => `  ${f.id}: ${f.message}`).join("\n"));
    return false;
  }
  console.log(green(`self-test PASS — ${expectBad.length} checks fired on the bad fixture, 0 HIGH on the clean fixture`));
  return true;
}

// ---------- main ----------
function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    process.exit(selfTest() ? 0 : 1);
    return;
  }
  const json = args.includes("--json");
  const paths = args.filter((a) => a !== "--json");
  if (!paths.length) {
    console.error(`usage: node webvitals.mjs <file.html|dir> [...] [--json]\n       node webvitals.mjs --self-test`);
    process.exit(2);
  }
  let files;
  try {
    files = collectFiles(paths);
  } catch (e) {
    console.error(red(`error: ${e.message}`));
    process.exit(2);
  }
  if (!files.length) {
    console.error(yellow("no .html/.htm files found in the given path(s)"));
    process.exit(2);
  }

  let anyHigh = false;
  const out = {};
  for (const f of files) {
    let raw;
    try {
      raw = readFileSync(f, "utf8");
    } catch (e) {
      console.error(red(`error reading ${f}: ${e.message}`));
      process.exit(2);
    }
    const findings = auditFile(raw);
    if (findings.some((x) => x.severity === "high")) anyHigh = true;
    out[basename(f)] = findings;
    if (!json) process.stdout.write(reportText(f, findings) + "\n");
  }
  if (json) console.log(JSON.stringify(out, null, 2));
  else console.log(dim(`\nwebvitals.mjs — static audit of ${files.length} file(s). Runtime metrics still need field/lab measurement (MANUAL.md §8).`));
  process.exit(anyHigh ? 1 : 0);
}

main();
