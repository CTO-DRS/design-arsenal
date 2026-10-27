#!/usr/bin/env node
/**
 * dataviz.mjs — static data-visualization linter for design-arsenal (dataviz module).
 * Zero dependencies. Node 18+.
 *
 * Usage:
 *   node dataviz.mjs page.html              audit one HTML file (text report)
 *   node dataviz.mjs page.html other.html   audit several files (dirs: depth 1)
 *   node dataviz.mjs src/ --json            machine-readable findings
 *   node dataviz.mjs --self-test            embedded fixtures, exit 0/1
 *
 * What it catches (static, structural — not a rendering test):
 *   HIGH CHART-NO-LABEL        chart-like <svg> with no accessible name (aria-label,
 *                              aria-labelledby, <title>) and not marked decorative
 *   HIGH CANVAS-NO-TEXT        <canvas> chart without a name AND without fallback
 *                              text content inside the element
 *   MED  CHART-NO-VIEWBOX      chart-like <svg> pinned to pixel width/height but
 *                              without a viewBox — it cannot scale fluidly
 *   MED  CHART-SCRIPT-BLOCKING chart library <script> without defer/async
 *   MED  CHART-ANIM-NO-GUARD   chart library present but the document never
 *                              mentions prefers-reduced-motion
 *   LOW  CHART-HARDCODED-COLOR inline hex fill/stroke inside a chart-like svg
 *                              instead of tokens / CSS variables
 *   LOW  CHART-LEGEND-MISSING series-classed charts on the page but no legend
 *   LOW  RTL-AXIS-LTR-HINT     RTL page loads a chart library but never declares
 *                              dir="ltr" — numeric axes/legends inherit RTL
 *
 * "Chart-like" svg = class hint (chart/graph/plot/viz/spark/series) OR
 * (>= 4 shape elements AND max dimension >= 64px) — small stroke icons never fire.
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

// ---------- preparation (preserve line numbers) ----------
function blankComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
}
function prepare(raw) {
  let doc = blankComments(raw);
  // keep <style> bodies (prefers-reduced-motion lives there); blank <script> bodies
  doc = doc.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi,
    (m, open, body, close) => open + body.replace(/[^\n]/g, " ") + close);
  return doc;
}
const lineOf = (doc, idx) => doc.slice(0, idx).split("\n").length;

// ---------- attribute helpers ----------
function getAttr(tag, name) {
  const re = new RegExp(`(?<![\\w-])${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? "").replace(/^["']|["']$/g, "");
}
function hasAttr(tag, name) {
  return new RegExp(`(?<![\\w-])${name}(?![\\w-])`, "i").test(tag);
}

// ---------- svg ranges (stack-matched; self-closing <svg/> yields empty range) ----------
function svgRanges(doc) {
  const ranges = [];
  const stack = [];
  for (const t of doc.matchAll(/<svg\b[^>]*?(\/?)>|<\/svg\s*>/gi)) {
    const isClose = t[0].startsWith("</");
    const selfClosed = !isClose && t[1] === "/";
    if (isClose) {
      const open = stack.pop();
      if (open !== undefined) ranges.push({ open: open.idx, close: t.index, openTag: open.tag });
    } else if (selfClosed) {
      ranges.push({ open: t.index, close: t.index, openTag: t[0] });
    } else {
      stack.push({ idx: t.index, tag: t[0] });
    }
  }
  // unclosed svg: treat rest of document as its range (still auditable)
  for (const s of stack) ranges.push({ open: s.idx, close: doc.length, openTag: s.tag });
  return ranges;
}

const CHART_CLASS = /chart|graph|plot|viz|spark|series/i;
const SHAPE_RE = /<(rect|circle|ellipse|line|polyline|polygon|path)\b/gi;

function classifySvg(doc, r) {
  const cls = getAttr(r.openTag, "class") || "";
  if (CHART_CLASS.test(cls)) return { chart: true, via: "class" };
  const inner = doc.slice(r.open + r.openTag.length, r.close);
  const shapes = (inner.match(SHAPE_RE) || []).length;
  let maxDim = 0;
  for (const a of ["width", "height"]) {
    const v = parseInt(getAttr(r.openTag, a) || "", 10);
    if (Number.isFinite(v)) maxDim = Math.max(maxDim, v);
  }
  const vb = getAttr(r.openTag, "viewBox");
  if (vb) for (const n of vb.trim().split(/[\s,]+/)) {
    const v = parseFloat(n);
    if (Number.isFinite(v)) maxDim = Math.max(maxDim, Math.abs(v));
  }
  return { chart: shapes >= 4 && maxDim >= 64, via: "shape-density" };
}

const svgHasName = (tag) => hasAttr(tag, "aria-label") || hasAttr(tag, "aria-labelledby");
const CHART_LIB_RE = /<script\b[^>]*src\s*=\s*["'][^"']*(chart\.js|charts\.js|d3(?:\.min|\.v\d)?\.|echarts|plotly|apexcharts|highcharts|frappe-charts|recharts|chartist)[^"']*["'][^>]*>/gi;

// grouped finding helper
function group(add, hits, id, severity, messageFn, fix) {
  if (!hits.length) return;
  add(id, severity, messageFn(hits.length), fix,
    [...new Set(hits.map((h) => h.line))].slice(0, 3));
}

// ---------- audit for one file ----------
function auditFile(raw, file) {
  const doc = prepare(raw);
  const findings = [];
  const add = (id, severity, message, fix, lines = []) =>
    findings.push({ id, severity, message, fix, file, lines });

  const ranges = svgRanges(doc);

  // chart-like svgs
  const charts = [];
  for (const r of ranges) {
    const c = classifySvg(doc, r);
    if (!c.chart) continue;
    charts.push({ ...r, line: lineOf(doc, r.open) });
  }

  // 1) CHART-NO-LABEL
  const noLabel = charts.filter((c) => {
    if (hasAttr(c.openTag, "aria-hidden")) return false;
    if (svgHasName(c.openTag)) return false;
    const inner = doc.slice(c.open, c.close);
    return !/<title[\s>]/i.test(inner);
  });
  group(add, noLabel, "CHART-NO-LABEL", "high",
    (n) => `${n} chart-like svg(s) with no accessible name — assistive tech announces nothing but "image", and the data is lost`,
    'add role="img" + aria-label="…what the chart shows…" (or a <title> child); pure decoration gets aria-hidden="true" plus a data table alternative (dataviz §3)');

  // 2) CANVAS-NO-TEXT
  const canvases = [...doc.matchAll(/<canvas\b[^>]*>([\s\S]*?)<\/canvas\s*>|<canvas\b[^>]*\/?>/gi)]
    .map((m) => ({ tag: m[0], inner: m[1] || "", idx: m.index, line: lineOf(doc, m.index) }));
  const deadCanvas = canvases.filter((c) => {
    if (hasAttr(c.tag, "aria-hidden")) return false;
    if (hasAttr(c.tag, "aria-label") || hasAttr(c.tag, "aria-labelledby")) return false;
    return !c.inner.replace(/&[a-z]+;|<[^>]*>|\s+/gi, "").length;
  });
  group(add, deadCanvas, "CANVAS-NO-TEXT", "high",
    (n) => `${n} canvas chart(s) with no accessible name and no fallback text — canvas pixels are invisible to assistive tech`,
    'expose the data: aria-label naming the chart + an offscreen data table (or render SVG instead); decorative canvas gets aria-hidden="true" (dataviz §3)');

  // 3) CHART-NO-VIEWBOX
  const noVb = charts.filter((c) => {
    if (hasAttr(c.openTag, "viewBox")) return false;
    return hasAttr(c.openTag, "width") || hasAttr(c.openTag, "height");
  });
  group(add, noVb, "CHART-NO-VIEWBOX", "medium",
    (n) => `${n} chart svg(s) pinned to pixel width/height without a viewBox — it cannot scale with its container and overflows small screens`,
    "set viewBox=\"0 0 W H\" and drop the pixel dimensions (or drive them from CSS) so the chart stays fluid (dataviz §8)");

  // 4) CHART-SCRIPT-BLOCKING
  const blocking = [...doc.matchAll(CHART_LIB_RE)]
    .map((m) => ({ tag: m[0], line: lineOf(doc, m.index) }))
    .filter((m) => !/defer|async/i.test(m.tag));
  group(add, blocking, "CHART-SCRIPT-BLOCKING", "medium",
    (n) => `${n} chart-library script(s) without defer/async — render-blocking JS in the critical path delays LCP for every visitor`,
    "add defer (chart bundles rarely need to run before DOMContentLoaded); lazy-load below-fold charts (dataviz §8)");

  // 5) CHART-ANIM-NO-GUARD
  const libLoaded = CHART_LIB_RE.test(doc);
  CHART_LIB_RE.lastIndex = 0;
  if (libLoaded && !/prefers-reduced-motion/i.test(doc))
    add("CHART-ANIM-NO-GUARD", "medium",
      "a chart library is loaded but the document never mentions prefers-reduced-motion — default entrance animations are unguarded vestibular triggers",
      "guard chart animations: CSS @media (prefers-reduced-motion) or the library's disable-animation option per user preference (dataviz §8)");

  // 6) CHART-HARDCODED-COLOR (inside chart-like svgs only)
  const hexHits = [];
  for (const c of charts) {
    const inner = doc.slice(c.open + c.openTag.length, c.close);
    for (const m of inner.matchAll(/\b(fill|stroke)\s*=\s*["']#[0-9a-f]{3,8}["']/gi))
      hexHits.push({ line: c.line });
  }
  group(add, hexHits, "CHART-HARDCODED-COLOR", "low",
    (n) => `${n} inline hex fill/stroke(s) inside chart markup — series colors bypass the token file and cannot follow the dark theme`,
    "drive series colors from CSS variables / design tokens (chart-1…chart-N with dark-theme variants), verified per theme (dataviz §4/§7)");

  // 7) CHART-LEGEND-MISSING
  const seriesCharts = charts.filter((c) => /series/i.test(getAttr(c.openTag, "class") || ""));
  if (seriesCharts.length && !/class\s*=\s*["'][^"']*legend/i.test(doc))
    add("CHART-LEGEND-MISSING", "low",
      "chart(s) with series classes but no legend element on the page — color-only encoding fails ~8% of male readers with color-vision deficiency",
      "add a legend with text labels (not swatches alone) or label the series directly at the marks (dataviz §3)");

  // 8) RTL-AXIS-LTR-HINT
  const rtlPage = /<(html|body)\b[^>]*dir\s*=\s*["']rtl["']/i.test(doc);
  if (rtlPage && libLoaded && !/\bdir\s*=\s*["']ltr["']/i.test(doc))
    add("RTL-AXIS-LTR-HINT", "low",
      "RTL page loads a chart library but never declares dir=\"ltr\" anywhere — numeric axes, tooltips and legends inherit RTL and get scrambled",
      "wrap chart containers in dir=\"ltr\" (keep captions/labels RTL) and verify axis order + number formatting after the flip (dataviz §6)");

  return findings;
}

// ---------- input collection ----------
function collectFiles(args) {
  const out = [];
  for (const a of args) {
    let st;
    try { st = statSync(a); } catch { console.error(`dataviz: cannot read ${a}`); process.exit(2); }
    if (st.isDirectory()) {
      for (const f of readdirSync(a)) {
        const e = extname(f).toLowerCase();
        if (e === ".html" || e === ".htm") out.push(join(a, f));
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
    try { raw = readFileSync(f, "utf8"); } catch { console.error(`dataviz: cannot read ${f}`); process.exit(2); }
    all.push(...auditFile(raw, f));
  }
  all.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.id.localeCompare(b.id));

  if (asJson) {
    console.log(JSON.stringify({ tool: "design-arsenal/dataviz", files: files.length, findings: all }, null, 2));
  } else {
    for (const f of files) console.log(cyan(`\n▸ ${f}`));
    if (!all.length) console.log(green("  ✓ no dataviz findings"));
    for (const f of all) {
      const tag = f.severity === "high" ? red("HIGH") : f.severity === "medium" ? yellow("MED ") : dim("LOW ");
      console.log(`  ${tag} ${bold(f.id)}  ${f.message}`);
      console.log(`      ${dim("fix:")} ${f.fix}`);
    }
    const high = all.filter((f) => f.severity === "high").length;
    const med = all.filter((f) => f.severity === "medium").length;
    const low = all.filter((f) => f.severity === "low").length;
    console.log(`\n${cyan("dataviz:")} ${files.length} file(s) — ${high} HIGH, ${med} medium, ${low} low`);
  }
  return all.some((f) => f.severity === "high") ? 1 : 0;
}

// ---------- self-test ----------
function selfTest() {
  const BAD_HTML = `<!doctype html><html lang="ar" dir="rtl"><head><title>bad</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
</head><body>
<svg class="chart" width="600" height="300">
  <rect x="0" y="200" width="60" height="100" fill="#5b8def"></rect>
  <rect x="80" y="150" width="60" height="150" fill="#34d399"></rect>
  <rect x="160" y="180" width="60" height="120" fill="#f59e0b"></rect>
  <rect x="240" y="120" width="60" height="180" fill="#ef4444"></rect>
</svg>
<canvas id="c1" width="400" height="240"></canvas>
<svg class="series-a" width="80" height="40" aria-label="شرائح الحصص"><circle cx="20" cy="20" r="18"/><circle cx="60" cy="20" r="18"/></svg>
</body></html>`;

  const GOOD_HTML = `<!doctype html><html lang="ar" dir="rtl"><head><title>good</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" defer></script>
<style>
  .legend { display: flex; gap: 14px; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
</style>
</head><body>
<figure>
  <svg class="chart" viewBox="0 0 320 180" role="img" aria-label="مبيعات الأربع سنوات">
    <title>مبيعات الأربع سنوات بالريال</title>
    <rect x="0" y="100" width="40" height="80" fill="var(--chart-1)"></rect>
    <rect x="60" y="80" width="40" height="100" fill="var(--chart-2)"></rect>
    <rect x="120" y="60" width="40" height="120" fill="var(--chart-3)"></rect>
    <rect x="180" y="40" width="40" height="140" fill="var(--chart-4)"></rect>
  </svg>
  <figcaption>الجدول المكافئ لهذه البيانات أدناه</figcaption>
</figure>
<div class="legend"><span class="series-1">٢٠٢٢</span><span class="series-2">٢٠٢٣</span></div>
<canvas id="c2" role="img" aria-label="رضا العملاء ربع سنوي">رضا العملاء: الربع الأول ٨٢٪، الربع الثاني ٨٥٪، الربع الثالث ٨٨٪، الربع الرابع ٩٠٪.</canvas>
<div dir="ltr" class="chart-wrap">
  <svg class="spark" viewBox="0 0 100 24" role="img" aria-label="اتجاه أسبوعي صاعد">
    <path d="M0 20 L25 16 L50 14 L75 8 L100 2" fill="none" stroke="currentColor" stroke-width="2"/>
  </svg>
</div>
<table><caption>مبيعات الأربع سنوات</caption><tr><th>السنة</th><th>البيع</th></tr><tr><td>٢٠٢٢</td><td>٨٠</td></tr></table>
</body></html>`;

  const ICONS_HTML = `<!doctype html><html lang="ar" dir="rtl"><body>
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
  <path d="M18 8a6 6 0 0 0-12 0"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/><circle cx="12" cy="3" r="1"/>
</svg>
<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 12.5l5.5 5.5L20 6.5"/><path d="M8 14h8"/><path d="M10 17h4"/><path d="M12 4v2"/></svg>
<canvas id="particles" aria-hidden="true"></canvas>
</body></html>`;

  const checks = [];
  const expect = (name, cond) => checks.push([name, cond]);
  const byId = (fs, id) => fs.filter((f) => f.id === id).length;

  const bad = auditFile(BAD_HTML, "bad.html");
  expect("BAD: CHART-NO-LABEL fired (svg.chart unnamed)", byId(bad, "CHART-NO-LABEL") === 1);
  expect("BAD: CANVAS-NO-TEXT fired (bare canvas)", byId(bad, "CANVAS-NO-TEXT") === 1);
  expect("BAD: CHART-NO-VIEWBOX fired (600x300, no viewBox)", byId(bad, "CHART-NO-VIEWBOX") === 1);
  expect("BAD: CHART-SCRIPT-BLOCKING fired (chart.js, no defer)", byId(bad, "CHART-SCRIPT-BLOCKING") === 1);
  expect("BAD: CHART-ANIM-NO-GUARD fired (lib + no prefers-reduced-motion)", byId(bad, "CHART-ANIM-NO-GUARD") === 1);
  expect("BAD: CHART-HARDCODED-COLOR fired (4 hex fills)", byId(bad, "CHART-HARDCODED-COLOR") === 1);
  expect("BAD: CHART-LEGEND-MISSING fired (series-a + no legend)", byId(bad, "CHART-LEGEND-MISSING") === 1);
  expect("BAD: RTL-AXIS-LTR-HINT fired (rtl + lib + no dir=ltr)", byId(bad, "RTL-AXIS-LTR-HINT") === 1);

  const good = auditFile(GOOD_HTML, "good.html");
  expect("GOOD: zero findings (named chart, viewBox, defer, guard, tokens, legend, dir=ltr, named canvas)", good.length === 0);

  const icons = auditFile(ICONS_HTML, "icons.html");
  expect("GUARD: small icon svgs never classify as charts (no label findings)", byId(icons, "CHART-NO-LABEL") === 0 && byId(icons, "CHART-NO-VIEWBOX") === 0);
  expect("GUARD: aria-hidden canvas exempt (decorative particles)", byId(icons, "CANVAS-NO-TEXT") === 0);
  expect("GUARD: no library → no guard/rtl-hint noise on icon pages", byId(icons, "CHART-ANIM-NO-GUARD") === 0 && byId(icons, "RTL-AXIS-LTR-HINT") === 0);

  let fails = 0;
  for (const [name, ok] of checks) {
    if (!ok) { console.log(red(`  ✗ ${name}`)); fails++; }
    else console.log(green(`  ✓ ${name}`));
  }
  if (fails) console.log(dim(`  [debug] BAD: ${bad.map((f) => f.id).join(", ")} | GOOD: ${good.map((f) => f.id).join(", ")} | ICONS: ${icons.map((f) => f.id).join(", ")}`));
  console.log(`\n${cyan("self-test:")} ${checks.length - fails}/${checks.length} checks passed`);
  if (fails) process.exit(1);
  process.exit(0);
}

// ---------- CLI ----------
const args = process.argv.slice(2);
if (args.includes("--self-test")) { selfTest(); }
else if (!args.length || args.some((a) => a === "-h" || a === "--help")) {
  console.log(`usage: node dataviz.mjs <file.html|dir/> [...] [--json]
       node dataviz.mjs --self-test`);
  process.exit(args.length ? 0 : 2);
} else {
  const asJson = args.includes("--json");
  const files = collectFiles(args.filter((a) => a !== "--json"));
  if (!files.length) { console.error("dataviz: no .html files found"); process.exit(2); }
  process.exit(report(files, asJson));
}
