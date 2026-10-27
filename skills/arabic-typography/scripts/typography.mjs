#!/usr/bin/env node
/**
 * typography.mjs — static Arabic-typography linter for design-arsenal
 * (arabic-typography module, original v2.8.0). Zero dependencies. Node 18+.
 *
 * Usage:
 *   node typography.mjs page.html              audit one HTML file (text report)
 *   node typography.mjs page.html other.html   audit several files (dirs: depth 1)
 *   node typography.mjs src/ --json            machine-readable findings
 *   node typography.mjs --self-test            embedded fixtures, exit 0/1
 *
 * What it catches (static, structural — not a rendering test):
 *   HIGH LETTERSPACING-AR     letter-spacing on Arabic text (inline on a text
 *                             element, or scoped to :lang(ar)/[lang=ar]/[dir=rtl])
 *                             — tracking tears the connected script apart
 *   HIGH LINEHEIGHT-CLIP      line-height < 1.5 on html/body/p in an Arabic page
 *                             — diacritics and dots collide with the line above
 *   MED  LINEHEIGHT-TIGHT     line-height 1.5–1.6 on html/body/p in an Arabic
 *                             page — Latin-tight, Arabic wants ≥ 1.6
 *   MED  LATIN-PUNCT-AR       Latin `,` `;` `?` glued to an Arabic letter in
 *                             visible text — Arabic has ، ؛ ؟
 *   MED  DIGIT-MIX            Arabic-Indic (٠١٢) and Latin (012) digits inside
 *                             one text run — two numeral policies on one line
 *   MED  TEXT-TRANSFORM-AR    text-transform on an Arabic-scoped selector — the
 *                             script has no case; browsers silently no-op it
 *   MED  FAKE-ITALIC-AR       font-style italic/oblique on an Arabic-scoped
 *                             selector — Arabic has no italics; browsers fake-slant
 *   MED  JUSTIFY-BREAKS       text-justify: inter-character/distribute in an
 *                             Arabic page — justification by splitting letters
 *   LOW  LINEHEIGHT-FIXED     line-height: NNNpx on html/body/p — a fixed line
 *                             box clips diacritics when the user scales text
 *   LOW  AR-QUOTE-ASCII       straight quotes "…" wrapping Arabic in visible
 *                             text — Arabic pairs are «…»
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

const ARABIC_RE = /[\u0600-\u06FF]/;
const AR_LETTER = /[\u0621-\u064A]/; // Arabic letters only (digits excluded on purpose)

/** selectors that explicitly scope a rule to Arabic script or RTL direction */
const AR_SCOPE =
  /:lang\s*\(\s*["']?ar\b|\[\s*lang\s*[~^|]?=\s*["']?ar\b|\[\s*dir\s*=\s*["']?rtl\b/i;
/** a bare element selector that ends in html/body/p (descendant chains allowed) */
const TEXT_ROOT_SEL = /(?:^|[\s>+~])(?:html|body|p)\s*(?::{1,2}[\w-]+)?\s*$/;

// ---------- document preparation (preserve line numbers) ----------
function blankComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
}
/** blank the bodies of blocks matched by `re` (keeps tags + line numbers).
 *  v2.8.0 fix: the callback must capture group 2 (the body) — a bare (m, body)
 *  signature receives the OPEN TAG as `body`, leaving script/style content
 *  visible to markup rules (latent bug inherited from i18n.mjs). */
function blankBodies(src, re) {
  return src.replace(re, (m, open, body) => m.replace(body, body.replace(/[^\n]/g, " ")));
}
const SCRIPT_RE = /(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi;
const STYLE_RE = /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi;

function prepare(raw) {
  let doc = blankComments(raw);
  doc = blankBodies(doc, SCRIPT_RE); // markup rules see tags only
  doc = blankBodies(doc, STYLE_RE);  // visible text = markup without CSS/JS
  return doc;
}
const lineOf = (doc, idx) => doc.slice(0, idx).split("\n").length;

/** collect <style> bodies with absolute offsets */
function styleBodies(raw) {
  const out = [];
  for (const m of raw.matchAll(STYLE_RE)) {
    out.push({ body: m[2], start: m.index + m[1].length });
  }
  return out;
}

// grouped finding helper
function group(add, hits, id, severity, messageFn, fix) {
  if (!hits.length) return;
  add(id, severity, messageFn(hits.length), fix,
    [...new Set(hits.map((h) => h.line))].slice(0, 3));
}

/** parse a line-height declaration → { ratio } or { px }, or null */
function lineHeightValue(decl) {
  const m = decl.match(/line-height\s*:\s*([0-9]*\.?[0-9]+)\s*(px|%|em|rem)?\s*(?:[;}]|$)/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  const unit = (m[2] || "").toLowerCase();
  if (unit === "px") return { px: v };
  if (unit === "%") return { ratio: v / 100 };
  return { ratio: v }; // unitless + em/rem
}
const lsReal = (decl) => {
  const m = decl.match(/letter-spacing\s*:\s*([^;}]+)/i);
  if (!m) return false;
  return !/^\s*(?:normal|0(?:px|em|rem)?|\.0+em)\s*$/i.test(m[1]);
};

// ---------- audit for one file ----------
function auditFile(raw, file) {
  const doc = prepare(raw);
  const findings = [];
  const add = (id, severity, message, fix, lines = []) =>
    findings.push({ id, severity, message, fix, file, lines });

  const styles = styleBodies(raw);
  const rules = [];
  for (const st of styles)
    for (const m of st.body.matchAll(/([^{}]+)\{([^{}]*)\}/g))
      rules.push({ sel: m[1], body: m[2], line: lineOf(doc, st.start + m.index) });

  // visible text runs (">text<") on prepared doc
  const runs = [];
  for (const m of doc.matchAll(/>([^<>]+)</g))
    runs.push({ text: m[1], idx: m.index, line: lineOf(doc, m.index) });
  const isArabicPage = runs.some((r) => ARABIC_RE.test(r.text));

  // 1) LETTERSPACING-AR — inline on a text element whose content is Arabic
  const lsInlineHits = [];
  for (const m of doc.matchAll(
    /<([a-z][a-z0-9]*)\b[^>]*\bstyle\s*=\s*["'][^"']*letter-spacing[^>]*>([^<]*)/gi
  )) {
    const tag = m[1].toLowerCase();
    if (/^(?:svg|path|img|canvas|video|iframe|input|select|textarea|br|hr)$/.test(tag)) continue;
    if (!lsReal(m[0])) continue;
    if (AR_LETTER.test(m[2])) lsInlineHits.push({ line: lineOf(doc, m.index) });
  }
  // …and CSS rules scoped to Arabic/RTL
  const lsCssHits = rules
    .filter((r) => lsReal(r.body) && AR_SCOPE.test(r.sel))
    .map((r) => ({ line: r.line }));
  const lsHits = [...lsInlineHits, ...lsCssHits];
  group(add, lsHits, "LETTERSPACING-AR", "high",
    (n) => `${n} letter-spacing declaration(s) reach Arabic text — tracking tears the connected script apart and reads as broken type`,
    "tracking belongs to Latin runs only (:lang(en) { letter-spacing: … }); for Arabic headlines use weight contrast inside one family — typography §3");

  // 2+3) LINEHEIGHT-CLIP / LINEHEIGHT-TIGHT / LINEHEIGHT-FIXED — html/body/p
  const clipHits = [], tightHits = [], fixedHits = [];
  if (isArabicPage) {
    for (const r of rules) {
      const selParts = r.sel.split(",");
      if (!selParts.some((p) => TEXT_ROOT_SEL.test(p.trim()))) continue;
      const lv = lineHeightValue(r.body);
      if (!lv) continue;
      if (lv.px !== undefined) { fixedHits.push({ line: r.line }); continue; }
      if (lv.ratio < 1.5) clipHits.push({ line: r.line });
      else if (lv.ratio < 1.6) tightHits.push({ line: r.line });
    }
  }
  group(add, clipHits, "LINEHEIGHT-CLIP", "high",
    (n) => `${n} line-height value(s) below 1.5 on html/body/p in an Arabic page — ascenders, dots and diacritics collide with the line above`,
    "Arabic body text wants 1.6–1.9 (unitless); display sizes tolerate 1.2–1.4 but body never — typography §2");
  group(add, tightHits, "LINEHEIGHT-TIGHT", "medium",
    (n) => `${n} line-height value(s) in 1.5–1.6 on html/body/p — Latin-tight; diacritics survive but rows feel dense in Arabic`,
    "raise Arabic body text to ≥ 1.6 unitless (1.7–1.9 for long paragraphs) — typography §2");
  group(add, fixedHits, "LINEHEIGHT-FIXED", "low",
    (n) => `${n} fixed px line-height value(s) on html/body/p — the line box cannot grow when the user scales text, so diacritics clip at 200% zoom`,
    "use a unitless line-height (1.7) so the box scales with the font — typography §2");

  // 4) LATIN-PUNCT-AR — Latin , ; ? glued to an Arabic letter (digit-following exempt)
  const punctHits = isArabicPage
    ? runs.filter((r) => /[\u0621-\u064A][\s\u00a0]*[,;?](?![\s\u00a0]*[0-9\u0660-\u0669])/.test(r.text))
        .map((r) => ({ line: r.line }))
    : [];
  group(add, punctHits, "LATIN-PUNCT-AR", "medium",
    (n) => `${n} Latin punctuation mark(s) , ; ? attached to Arabic words in visible text — Arabic has its own ، ؛ ؟`,
    "replace Latin , ; ? with Arabic ، ؛ ؟ in Arabic runs (quotes too: «…») — typography §6");

  // 5) DIGIT-MIX — Arabic-Indic and Latin digits in one run
  const mixHits = isArabicPage
    ? runs.filter((r) => /[0-9]/.test(r.text) && /[\u0660-\u0669]/.test(r.text))
        .map((r) => ({ line: r.line }))
    : [];
  group(add, mixHits, "DIGIT-MIX", "medium",
    (n) => `${n} text run(s) mix Arabic-Indic (٠١٢) and Latin (012) digits — two numeral policies on one line`,
    "pick ONE numeral system per product and hold it everywhere (Intl + nu option, i18n §3) — typography §6");

  // 6) TEXT-TRANSFORM-AR — case ops on Arabic-scoped selectors
  const ttHits = rules
    .filter((r) => /text-transform\s*:\s*(?:uppercase|lowercase|capitalize)/i.test(r.body) && AR_SCOPE.test(r.sel))
    .map((r) => ({ line: r.line }));
  group(add, ttHits, "TEXT-TRANSFORM-AR", "medium",
    (n) => `${n} text-transform declaration(s) on Arabic-scoped selectors — the script has no upper/lower case; browsers silently no-op it (or distort mixed runs)`,
    "delete it, or scope it to :lang(en) runs; emphasis in Arabic comes from weight/size/color — typography §3");

  // 7) FAKE-ITALIC-AR — italic/oblique on Arabic-scoped selectors
  const itHits = rules
    .filter((r) => /font-style\s*:\s*(?:italic|oblique)/i.test(r.body) && AR_SCOPE.test(r.sel))
    .map((r) => ({ line: r.line }));
  group(add, itHits, "FAKE-ITALIC-AR", "medium",
    (n) => `${n} font-style italic/oblique declaration(s) on Arabic-scoped selectors — Arabic has no italics; browsers slant a script that was never drawn for it`,
    "use weight contrast, size, or color for Arabic emphasis; italic belongs to :lang(en) runs — typography §3");

  // 8) JUSTIFY-BREAKS — justification by splitting letters
  const jsHits = isArabicPage
    ? rules.filter((r) => /text-justify\s*:\s*(?:inter-character|inter-ideograph|distribute)/i.test(r.body))
        .map((r) => ({ line: r.line }))
    : [];
  group(add, jsHits, "JUSTIFY-BREAKS", "medium",
    (n) => `${n} text-justify declaration(s) justify by stretching between characters — that splits the connected Arabic script`,
    "keep default inter-word justification (or kashida-aware engines only); never inter-character — typography §7");

  // 9) AR-QUOTE-ASCII — straight quotes around Arabic
  const quoteHits = isArabicPage
    ? runs.filter((r) => /"[^"\n]{0,80}[\u0621-\u064A][^"\n]{0,80}"/.test(r.text))
        .map((r) => ({ line: r.line }))
    : [];
  group(add, quoteHits, "AR-QUOTE-ASCII", "low",
    (n) => `${n} straight quote pair(s) "…" wrapping Arabic text — Arabic typographic pairs are «…» (or “…” in fonts that ship them)`,
    "wrap Arabic quotations in «…» — typography §6");

  return findings;
}

// ---------- input collection ----------
function collectFiles(args) {
  const out = [];
  for (const a of args) {
    let st;
    try { st = statSync(a); } catch { console.error(`typography: cannot read ${a}`); process.exit(2); }
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
    try { raw = readFileSync(f, "utf8"); } catch { console.error(`typography: cannot read ${f}`); process.exit(2); }
    all.push(...auditFile(raw, f));
  }
  all.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.id.localeCompare(b.id));

  if (asJson) {
    console.log(JSON.stringify({ tool: "design-arsenal/arabic-typography", files: files.length, findings: all }, null, 2));
  } else {
    for (const f of files) console.log(cyan(`\n▸ ${f}`));
    if (!all.length) console.log(green("  ✓ no Arabic-typography findings"));
    for (const f of all) {
      const tag = f.severity === "high" ? red("HIGH") : f.severity === "medium" ? yellow("MED ") : dim("LOW ");
      console.log(`  ${tag} ${bold(f.id)}  ${f.message}`);
      console.log(`      ${dim("fix:")} ${f.fix}`);
    }
    const high = all.filter((f) => f.severity === "high").length;
    const med = all.filter((f) => f.severity === "medium").length;
    const low = all.filter((f) => f.severity === "low").length;
    console.log(`\n${cyan("typography:")} ${files.length} file(s) — ${high} HIGH, ${med} medium, ${low} low`);
  }
  return all.some((f) => f.severity === "high") ? 1 : 0;
}

// ---------- self-test ----------
function selfTest() {
  const BAD_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head><title>bad</title>
<style>
body { line-height: 1.3; }
p { line-height: 1.55; }
main p { line-height: 20px; }
[dir="rtl"] .hero-title { letter-spacing: .05em; }
[lang="ar"] blockquote { font-style: italic; }
[dir="rtl"] .caps { text-transform: uppercase; }
article p { text-align: justify; text-justify: inter-character; }
.en-kicker { letter-spacing: .2em; }
h1 { line-height: 1.15; }
</style>
</head>
<body>
<h1 style="letter-spacing:2px">عنوان رئيسي متباعد</h1>
<p>أهلاً بك, في متجرنا? نعم؛</p>
<p>لديك ٢٥ منتجاً من أصل 25 منتجاً في السلة</p>
<blockquote>قرأ الطالب "الكتاب" الممتع كاملًا</blockquote>
</body>
</html>`;

  const GOOD_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head><title>good</title>
<style>
body { line-height: 1.8; }
article p { line-height: 1.7; }
h1 { line-height: 1.2; }
:lang(en) .en-kicker { letter-spacing: .2em; text-transform: uppercase; font-style: italic; }
</style>
</head>
<body>
<h1>منصة الكتاب الرقمي</h1>
<p>أهلاً بك في متجرنا — الجديد؟ وصل؛ جاهز للاستخدام.</p>
<p>لديك ٢٥ منتجاً في السلة وسعرها ١٢٠ ريالاً</p>
<blockquote>قال الكاتب: «القراءة عادة ذكية» وهو محق</blockquote>
</body>
</html>`;

  const GUARD_HTML = `<!doctype html>
<html lang="en" dir="ltr">
<head><title>guard</title>
<style>
body { line-height: 1.3; }
p { line-height: 16px; }
.kicker { letter-spacing: .25em; text-transform: uppercase; }
.lede { font-style: italic; }
[data-dir] .x { text-justify: inter-character; }
</style>
</head>
<body>
<p class="kicker">DESIGN NOTES</p>
<p>English page, "quoted text", items 25 of 100, wait; really?</p>
</body>
</html>`;

  const EXEMPT_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head><title>exempt</title>
<style>
h1 { line-height: 1.2; }
.en-kicker { letter-spacing: .2em; text-transform: uppercase; }
</style>
</head>
<body>
<h1>عنوان ضيق مقبول</h1>
<p class="en-kicker">DESIGN ARSENAL</p>
<p>نص عربي طبيعي بارتفاع سليم «مع اقتباس صحيح»</p>
</body>
</html>`;

  const checks = [];
  const expect = (name, cond) => checks.push([name, cond]);
  const byId = (fs, id) => fs.filter((f) => f.id === id).length;

  const bad = auditFile(BAD_HTML, "bad.html");
  expect("BAD: LETTERSPACING-AR fired (inline Arabic + [dir=rtl] rule — grouped)", byId(bad, "LETTERSPACING-AR") === 1 && byId(bad, "LETTERSPACING-AR") >= 1 && bad.find((f) => f.id === "LETTERSPACING-AR").lines.length === 2);
  expect("BAD: LINEHEIGHT-CLIP fired (body 1.3)", byId(bad, "LINEHEIGHT-CLIP") === 1);
  expect("BAD: LINEHEIGHT-TIGHT fired (p 1.55)", byId(bad, "LINEHEIGHT-TIGHT") === 1);
  expect("BAD: LINEHEIGHT-FIXED fired (main p 20px)", byId(bad, "LINEHEIGHT-FIXED") === 1);
  expect("BAD: LATIN-PUNCT-AR fired (, ? in Arabic runs)", byId(bad, "LATIN-PUNCT-AR") >= 1);
  expect("BAD: DIGIT-MIX fired (٢٥ + 25 one run)", byId(bad, "DIGIT-MIX") === 1);
  expect("BAD: TEXT-TRANSFORM-AR fired ([dir=rtl] uppercase)", byId(bad, "TEXT-TRANSFORM-AR") === 1);
  expect("BAD: FAKE-ITALIC-AR fired ([lang=ar] italic)", byId(bad, "FAKE-ITALIC-AR") === 1);
  expect("BAD: JUSTIFY-BREAKS fired (inter-character)", byId(bad, "JUSTIFY-BREAKS") === 1);
  expect("BAD: AR-QUOTE-ASCII fired (\"الكتاب\")", byId(bad, "AR-QUOTE-ASCII") === 1);

  const good = auditFile(GOOD_HTML, "good.html");
  expect("GOOD: zero findings (1.8/1.7 body, :lang(en) tracking, «» quotes, uniform digits)", good.length === 0);

  const guard = auditFile(GUARD_HTML, "guard.html");
  expect("GUARD: English page → no Arabic findings at all (tight/px line-height, tracking, caps, italic)", guard.length === 0);

  const exempt = auditFile(EXEMPT_HTML, "exempt.html");
  expect("EXEMPT: display line-height 1.2 on h1 tolerated", byId(exempt, "LINEHEIGHT-CLIP") === 0 && byId(exempt, "LINEHEIGHT-TIGHT") === 0);
  expect("EXEMPT: unscoped tracking on a Latin kicker stays silent", byId(exempt, "LETTERSPACING-AR") === 0);
  expect("EXEMPT: «» quotes and uniform digits pass", byId(exempt, "AR-QUOTE-ASCII") === 0 && byId(exempt, "DIGIT-MIX") === 0);

  let fails = 0;
  for (const [name, ok] of checks) {
    if (!ok) { console.log(red(`  ✗ ${name}`)); fails++; }
    else console.log(green(`  ✓ ${name}`));
  }
  if (fails) console.log(dim(`  [debug] BAD: ${bad.map((f) => f.id).join(", ")} | GOOD: ${good.map((f) => f.id).join(", ")} | GUARD: ${guard.map((f) => f.id).join(", ")} | EXEMPT: ${exempt.map((f) => f.id).join(", ")}`));
  console.log(`\n${cyan("self-test:")} ${checks.length - fails}/${checks.length} checks passed`);
  if (fails) process.exit(1);
  process.exit(0);
}

// ---------- CLI ----------
const args = process.argv.slice(2);
if (args.includes("--self-test")) { selfTest(); }
else if (!args.length || args.some((a) => a === "-h" || a === "--help")) {
  console.log(`usage: node typography.mjs <file.html|dir/> [...] [--json]
       node typography.mjs --self-test`);
  process.exit(args.length ? 0 : 2);
} else {
  const asJson = args.includes("--json");
  const files = collectFiles(args.filter((a) => a !== "--json"));
  if (!files.length) { console.error("typography: no .html files found"); process.exit(2); }
  process.exit(report(files, asJson));
}
