#!/usr/bin/env node
/**
 * responsive.mjs — static responsive/fluid linter for design-arsenal (responsive module).
 * Zero dependencies. Node 18+.
 *
 * Usage:
 *   node responsive.mjs page.html               audit one HTML file (text report)
 *   node responsive.mjs page.html other.css     audit HTML/CSS files (dirs: depth 1)
 *   node responsive.mjs src/ --json             machine-readable findings
 *   node responsive.mjs --self-test             embedded fixtures, exit 0/1
 *
 * What it catches (static, structural — not a live-device test):
 *   HIGH VIEWPORT-MISSING   no <meta name="viewport"> — phones fake a 980px viewport
 *   HIGH VIEWPORT-LOCK      user-scalable=no or maximum-scale < 2 (WCAG 1.4.4 zoom fail)
 *   HIGH PX-ROOT-FONT       html/:root { font-size: NNNpx } — breaks user zoom + fluid type
 *   MED FIXED-WIDTH         width: NNNpx (NNN >= 480) — overflow risk at 320–360px viewports
 *   MED VW-OVERFLOW         width/min-width: 100vw — horizontal scroll with any vertical scrollbar
 *   MED NO-FLUID-OR-MQ      CSS has neither clamp()/min()/max() nor @media — likely a fixed design
 *   LOW FULL-HEIGHT-VH      height: 100vh — prefer 100dvh/100svh (mobile URL bar jumps)
 *   LOW SRCSET-HINT         first raster <img> without srcset/sizes — wasted bytes, worse LCP
 *
 * Exit codes: 0 no HIGH findings · 1 HIGH findings present · 2 usage/parse error.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

// ---------- tiny ANSI helpers ----------
const tty = process.stdout.isTTY;
const C = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const cyan = (s) => C("36", s), red = (s) => C("31", s), yellow = (s) => C("33", s);
const dim = (s) => C("2", s), bold = (s) => C("1", s), green = (s) => C("32", s);

// ---------- preparation ----------
// Blank comments and <script> bodies while preserving every newline, so line
// numbers stay faithful. <style> bodies are extracted in full for CSS checks.
function blankComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
}

function prepare(raw) {
  const styleBodies = [];
  let doc = blankComments(raw);
  doc = doc.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi,
    (m, open, body, close) => open + body.replace(/[^\n]/g, " ") + close);
  doc = doc.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
    (m, open, body, close) => { styleBodies.push(body); return open + body.replace(/[^\n]/g, " ") + close; });
  return { doc, styleBodies };
}

const lineOf = (doc, idx) => doc.slice(0, idx).split("\n").length;

// ---------- CSS checks (shared by <style> blocks, inline style="", and .css files) ----------
function cssFindings(cssText, add) {
  if (!cssText.trim()) return;

  // 3) PX-ROOT-FONT — html/:root with a px font-size
  const rootBlocks = [...cssText.matchAll(/(?<![\w.#-])(?:html|:root)\s*\{[^}]*\}/gi)];
  const rootPx = rootBlocks.filter((m) => /font-size\s*:\s*\d+(\.\d+)?\s*px/i.test(m[0]));
  if (rootPx.length)
    add("PX-ROOT-FONT", "high",
      `${rootPx.length} html/:root rule(s) set font-size in px — locks out user zoom and the rem scale`,
      "html { font-size: clamp(1rem, 0.92rem + 0.3vw, 1.125rem) } — never px on the root (responsive §3)");

  // 4) FIXED-WIDTH — width: NNNpx (>= 480), excluding max-width/min-width
  const fixed = [...cssText.matchAll(/(?<![\w-])width\s*:\s*(\d{3,})\s*px/gi)]
    .filter((m) => parseInt(m[1], 10) >= 480);
  if (fixed.length)
    add("FIXED-WIDTH", "medium",
      `${fixed.length} fixed width: ${fixed[0][1]}px declaration(s) — overflows 320–360px viewports`,
      "use width: min(100% - 2rem, 72rem) / fluid units; reserve fixed px for decorative inner elements (responsive §4/§5)");

  // 5) VW-OVERFLOW — width/min-width: 100vw
  const vws = [...cssText.matchAll(/(?<![\w-])(?:min-)?width\s*:\s*100vw/gi)];
  if (vws.length)
    add("VW-OVERFLOW", "medium",
      `${vws.length} width: 100vw declaration(s) — 100vw includes the vertical scrollbar, so horizontal overflow appears as soon as the page scrolls`,
      "use width: 100% on containers, or 100dvh for heights (responsive §4)");

  // 7) FULL-HEIGHT-VH — height: 100vh
  const vhs = [...cssText.matchAll(/(?<![\w-])(?:min-)?height\s*:\s*100vh\b/gi)];
  if (vhs.length)
    add("FULL-HEIGHT-VH", "low",
      `${vhs.length} height: 100vh declaration(s) — jumps as the mobile URL bar collapses (CLS on mobile)`,
      "prefer min-height: 100svh (first paint) or 100dvh (live viewport) for full-screen sections (responsive §4)");

  // 6) NO-FLUID-OR-MQ — real CSS but zero fluid functions and zero media/container queries
  const hasRules = cssText.includes("{");
  const hasFluid = /clamp\(|\bmin\(|\bmax\(|@media|@container/i.test(cssText);
  if (hasRules && !hasFluid)
    add("NO-FLUID-OR-MQ", "medium",
      "stylesheet declares rules but contains no clamp()/min()/max(), no @media and no @container — almost certainly a fixed-size design",
      "make type and spacing fluid with clamp(), grids with auto-fit, and keep @media for structural change only (responsive §1/§3/§5)");
}

// ---------- HTML + CSS audit for one file ----------
function auditFile(raw, file) {
  const { doc, styleBodies } = prepare(raw);
  const findings = [];
  const add = (id, severity, message, fix, lines = []) =>
    findings.push({ id, severity, message, fix, file, lines });

  // CSS from <style> blocks + inline style="…"
  const inlineStyles = [...doc.matchAll(/\bstyle\s*=\s*["']([^"']*)["']/gi)].map((m) => m[1]);
  cssFindings(styleBodies.join("\n;\n") + "\n" + inlineStyles.join("\n"), add);

  const isHtmlish = /<\/?(html|body|head|div|p|img|section)\b/i.test(doc);

  if (isHtmlish) {
    // 1) VIEWPORT-MISSING / 2) VIEWPORT-LOCK
    const vp = doc.match(/<meta\b[^>]*name\s*=\s*["']viewport["'][^>]*>/i);
    if (!vp) {
      add("VIEWPORT-MISSING", "high",
        "no <meta name=\"viewport\"> — phones fake a ~980px viewport and shrink the whole page",
        "add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> to <head> (responsive §2)");
    } else {
      const content = vp[0].match(/content\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
      const lockScale = content.match(/maximum-scale\s*=\s*([\d.]+)/i);
      if (/user-scalable\s*=\s*(?:no|0)/i.test(content) || (lockScale && parseFloat(lockScale[1]) < 2)) {
        add("VIEWPORT-LOCK", "high",
          "viewport meta locks zoom (user-scalable=no or maximum-scale < 2) — WCAG 1.4.4 failure",
          "use content=\"width=device-width, initial-scale=1\" — never restrict zoom (responsive §2)");
      }
    }

    // 8) SRCSET-HINT — first raster <img> without srcset/sizes
    const firstImg = doc.match(/<img\b[^>]*>/i);
    if (firstImg) {
      const tag = firstImg[0];
      const src = tag.match(/\bsrc\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
      const raster = !/\.svg(\?|#|$)/i.test(src) && !/^data:image\/svg/i.test(src);
      if (raster && !/\bsrcset\s*=|\bsizes\s*=/i.test(tag))
        add("SRCSET-HINT", "low",
          "first <img> has no srcset/sizes — mobile downloads desktop bytes and LCP suffers",
          "add srcset with width descriptors + sizes, keep width/height and fetchpriority=\"high\" on the hero (responsive §7)",
          [lineOf(doc, firstImg.index)]);
    }
  }

  return findings;
}

// ---------- input collection ----------
function collectFiles(args) {
  const out = [];
  for (const a of args) {
    let st;
    try { st = statSync(a); } catch { console.error(`responsive: cannot read ${a}`); process.exit(2); }
    if (st.isDirectory()) {
      for (const f of readdirSync(a)) {
        const e = extname(f).toLowerCase();
        if (e === ".html" || e === ".htm" || e === ".css") out.push(join(a, f));
      }
    } else out.push(a);
  }
  return out;
}

const SEV_ORDER = { high: 0, medium: 1, low: 2 };
function report(files, asJson) {
  const all = [];
  for (const f of files) {
    let raw;
    try { raw = readFileSync(f, "utf8"); } catch { console.error(`responsive: cannot read ${f}`); process.exit(2); }
    all.push(...auditFile(raw, f));
  }
  all.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.id.localeCompare(b.id));

  if (asJson) {
    console.log(JSON.stringify({ tool: "design-arsenal/responsive", files: files.length, findings: all }, null, 2));
  } else {
    for (const f of files) console.log(cyan(`\n▸ ${f}`));
    if (!all.length) { console.log(green("  ✓ no responsive findings")); }
    for (const f of all) {
      const tag = f.severity === "high" ? red("HIGH") : f.severity === "medium" ? yellow("MED ") : dim("LOW ");
      console.log(`  ${tag} ${bold(f.id)}  ${f.message}`);
      console.log(`      ${dim("fix:")} ${f.fix}`);
    }
    const high = all.filter((f) => f.severity === "high").length;
    const med = all.filter((f) => f.severity === "medium").length;
    const low = all.filter((f) => f.severity === "low").length;
    console.log(`\n${cyan("responsive:")} ${files.length} file(s) — ${high} HIGH, ${med} medium, ${low} low`);
  }
  return all.some((f) => f.severity === "high") ? 1 : 0;
}

// ---------- self-test ----------
function selfTest() {
  const BAD_HTML = `<!doctype html><html><head><title>bad</title>
<style>
html { font-size: 16px; }
.card { width: 960px; padding: 12px; }
.hero { width: 100vw; min-height: 100vh; }
</style></head>
<body><img src="hero.jpg" alt="hero"><p style="width: 720px">hi</p></body></html>`;

  const LOCK_HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<style>.g { display: grid; gap: clamp(1rem, 2vw, 2rem); }</style></head><body>x</body></html>`;

  const GOOD_HTML = `<!doctype html><html lang="ar" dir="rtl"><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
html { font-size: clamp(1rem, 0.92rem + 0.3vw, 1.125rem); }
.wrap { width: min(100% - 2rem, 72rem); margin-inline: auto; }
.grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr)); }
.hero { min-height: 100svh; }
@media (min-width: 48em) { .nav { display: flex; } }
</style></head>
<body><img src="hero-800.avif" srcset="hero-400.avif 400w, hero-800.avif 800w" sizes="100vw" width="1600" height="900" alt="hero"></body></html>`;

  const GOOD_CSS = `html { font-size: clamp(1rem, 1rem + 0.25vw, 1.25rem); }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: 1rem; }
.panel { width: min(100%, 40rem); min-height: 100dvh; }
@container (min-width: 28rem) { .card { display: grid; } }
@media (max-width: 48em) { .sidebar { display: none; } }`;

  const checks = [];
  const expect = (name, cond) => checks.push([name, cond]);
  const byId = (fs, id) => fs.filter((f) => f.id === id).length;

  const bad = auditFile(BAD_HTML, "bad.html");
  expect("BAD: VIEWPORT-MISSING fired", byId(bad, "VIEWPORT-MISSING") === 1);
  expect("BAD: PX-ROOT-FONT fired", byId(bad, "PX-ROOT-FONT") === 1);
  const fw = bad.filter((f) => f.id === "FIXED-WIDTH");
  expect("BAD: FIXED-WIDTH grouped finding counts both (960px block + 720px inline)", fw.length === 1 && /2 fixed width/.test(fw[0].message));
  expect("BAD: VW-OVERFLOW fired (100vw)", byId(bad, "VW-OVERFLOW") === 1);
  expect("BAD: FULL-HEIGHT-VH fired (100vh)", byId(bad, "FULL-HEIGHT-VH") === 1);
  expect("BAD: NO-FLUID-OR-MQ fired", byId(bad, "NO-FLUID-OR-MQ") === 1);
  expect("BAD: SRCSET-HINT fired (hero.jpg)", byId(bad, "SRCSET-HINT") === 1);
  expect("BAD: no false VIEWPORT-LOCK", byId(bad, "VIEWPORT-LOCK") === 0);

  const lock = auditFile(LOCK_HTML, "lock.html");
  expect("LOCK: VIEWPORT-LOCK fired (user-scalable=no)", byId(lock, "VIEWPORT-LOCK") === 1);
  expect("LOCK: VIEWPORT-MISSING silent", byId(lock, "VIEWPORT-MISSING") === 0);

  const good = auditFile(GOOD_HTML, "good.html");
  expect("GOOD: zero findings", good.length === 0);

  const goodCss = auditFile(GOOD_CSS, "good.css");
  expect("GOOD CSS: zero findings", goodCss.length === 0);

  // strict min/max false-positive guard: minmax() must NOT satisfy NO-FLUID via \bmin\( —
  // it should (minmax contains "min" only as part of minmax(, so \bmin\( does not match).
  const onlyMinmax = auditFile(`<style>.x { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }</style>`, "mm.html");
  expect("GUARD: minmax-only CSS still flagged as NO-FLUID-OR-MQ", byId(onlyMinmax, "NO-FLUID-OR-MQ") === 1);

  let fails = 0;
  for (const [name, ok] of checks) {
    if (!ok) { console.log(red(`  ✗ ${name}`)); fails++; }
    else console.log(green(`  ✓ ${name}`));
  }
  if (fails) console.log(dim(`  [debug] BAD findings: ${bad.map((f) => f.id).join(", ")}`));
  console.log(`\n${cyan("self-test:")} ${checks.length - fails}/${checks.length} checks passed`);
  if (fails) process.exit(1);
  process.exit(0);
}

// ---------- CLI ----------
const args = process.argv.slice(2);
if (args.includes("--self-test")) { selfTest(); }
else if (!args.length || args.some((a) => a === "-h" || a === "--help")) {
  console.log(`usage: node responsive.mjs <file.html|file.css|dir/> [...] [--json]
       node responsive.mjs --self-test`);
  process.exit(args.length ? 0 : 2);
} else {
  const asJson = args.includes("--json");
  const files = collectFiles(args.filter((a) => a !== "--json"));
  if (!files.length) { console.error("responsive: no .html/.css files found"); process.exit(2); }
  process.exit(report(files, asJson));
}
