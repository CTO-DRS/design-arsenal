#!/usr/bin/env node
/**
 * i18n.mjs — static internationalization linter for design-arsenal (i18n module).
 * Zero dependencies. Node 18+.
 *
 * Usage:
 *   node i18n.mjs page.html              audit one HTML file (text report)
 *   node i18n.mjs page.html other.html   audit several files (dirs: depth 1)
 *   node i18n.mjs src/ --json            machine-readable findings
 *   node i18n.mjs --self-test            embedded fixtures, exit 0/1
 *
 * What it catches (static, structural — not a rendering test):
 *   HIGH LANG-MISSING          <html> tag without a lang attribute — assistive
 *                              tech and Intl fall back to the wrong language
 *   HIGH ARABIC-NO-DIR         Arabic content present but <html> declares no
 *                              dir — layout order is left to browser guesswork
 *   MED  MANUAL-DATE           a date built by hand (`${y}/${m}/${d}` template
 *                              using getFullYear/getMonth/getDate) instead of Intl
 *   MED  LOCALE-HARDCODED      hardcoded 'en'/'en-US' locale inside Intl
 *                              constructors / toLocaleString — silently overrides
 *                              the user's language
 *   MED  TOFIXED-MONEY         .toFixed(N) on a money-looking value instead of
 *                              Intl.NumberFormat currency style
 *   MED  PLURAL-GENERIC        visible text with an "(s)" suffix — one plural
 *                              string for every count/language
 *   MED  FIXED-WIDTH-TEXT      inline style width:Npx on a <button>/<a> — the
 *                              label is guaranteed to clip in a longer locale
 *   LOW  FIXED-WIDTH-CSS-HINT  CSS rule with fixed px width on a button/badge/
 *                              chip/tag/label-ish selector (icon-ish selectors
 *                              exempt) — verify it never carries text
 *   LOW  FONT-NOSUBSET         @font-face without unicode-range — the whole
 *                              glyph set loads for every visitor
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

// ---------- document preparation (preserve line numbers) ----------
function blankComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
}
/** blank the bodies of blocks matched by `re` (keeps tags + line numbers).
 *  v2.8.0 fix: capture group 2 (the body) — a bare (m, body) signature received
 *  the OPEN TAG as `body`, leaving script/style content visible to markup rules. */
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

/** collect inline <script> bodies (skip src= and ld+json) with absolute offsets */
function scriptBodies(raw) {
  const out = [];
  for (const m of raw.matchAll(SCRIPT_RE)) {
    const open = m[1];
    if (/\bsrc\s*=/i.test(open)) continue;
    if (/type\s*=\s*["'][^"']*ld\+json/i.test(open)) continue;
    const bodyStart = m.index + open.length;
    out.push({ body: m[2], start: bodyStart });
  }
  return out;
}
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

// ---------- audit for one file ----------
function auditFile(raw, file) {
  const doc = prepare(raw);
  const findings = [];
  const add = (id, severity, message, fix, lines = []) =>
    findings.push({ id, severity, message, fix, file, lines });

  const htmlTag = doc.match(/<html\b[^>]*>/i);
  const scripts = scriptBodies(raw);
  const styles = styleBodies(raw);

  // visible text runs (for plural/bidi-ish rules): ">text<" runs on prepared doc
  const runs = [];
  for (const m of doc.matchAll(/>([^<>]+)</g)) {
    runs.push({ text: m[1], idx: m.index, line: lineOf(doc, m.index) });
  }
  const visibleText = runs.map((r) => r.text).join("\n");

  // 1) LANG-MISSING
  if (htmlTag && !/\blang\s*=\s*["']?[\w-]+/i.test(htmlTag[0]))
    add("LANG-MISSING", "high",
      "the <html> tag declares no lang — screen readers announce the wrong language and Intl falls back to the platform locale",
      'set <html lang="ar" dir="rtl"> (both attributes, first line) and give any element in another language its own lang (i18n §2)');

  // 2) ARABIC-NO-DIR
  if (htmlTag && ARABIC_RE.test(visibleText) && !/\bdir\s*=\s*["']?(?:rtl|ltr|auto)/i.test(htmlTag[0]))
    add("ARABIC-NO-DIR", "high",
      "Arabic content present but <html> declares no dir — line order, punctuation flow and form fields are left to browser guesswork",
      'declare the direction on the first line: <html lang="ar" dir="rtl"> — direction is a page-level architectural choice (i18n §2)');

  // 3) MANUAL-DATE (inline JS: date template with getFullYear/getMonth/getDate + separator)
  const dateHits = [];
  for (const s of scripts) {
    for (const m of s.body.matchAll(/`[^`]*`/gs)) {
      if (/\$\{[^}]*\b(?:getFullYear|getMonth|getDate|getDay)\b/.test(m[0]) && /[/-]/.test(m[0]))
        dateHits.push({ line: lineOf(doc, s.start + m.index) });
    }
  }
  group(add, dateHits, "MANUAL-DATE", "medium",
    (n) => `${n} date(s) formatted by hand in template literals (getFullYear/getMonth/getDate + separators) — the format is wrong in every locale except the one you tested`,
    "format through Intl.DateTimeFormat(locale, …) once, centrally; decide the calendar and numeral system as product config, not per screen (i18n §3)");

  // 4) LOCALE-HARDCODED ('en'/'en-US' pinned inside Intl calls)
  const localeHits = [];
  const LOCALE_CALL_RE = /\b(?:toLocaleString|toLocaleDateString|toLocaleTimeString)\s*\(\s*["']en(?:-US|-GB)?["']|new\s+Intl\.(?:NumberFormat|DateTimeFormat|RelativeTimeFormat|ListFormat|PluralRules|DisplayNames|Collator|Segmenter)\s*\(\s*["']en(?:-US|-GB)?["']/g;
  for (const s of scripts)
    for (const m of s.body.matchAll(LOCALE_CALL_RE))
      localeHits.push({ line: lineOf(doc, s.start + m.index) });
  group(add, localeHits, "LOCALE-HARDCODED", "medium",
    (n) => `${n} Intl call(s) pin the 'en' locale literally — the user's language is silently overridden and the page is not internationalized`,
    'pass the runtime locale (document.documentElement.lang / saved preference) or omit the argument; pinning "ar-EG" is fine, pinning "en" is not (i18n §3)');

  // 5) TOFIXED-MONEY (.toFixed near currency markers)
  const MONEY_MARK = /(ر\.س|ريال|SAR|USD|EUR|GBP|\$|€|£|السعر|الإجمالي|المجموع|المبلغ|price|total|amount|cost|fee|subtotal)/i;
  const moneyHits = [];
  for (const s of scripts) {
    for (const m of s.body.matchAll(/\.toFixed\s*\(\s*\d+\s*\)/g)) {
      const from = Math.max(0, m.index - 120);
      const win = s.body.slice(from, m.index + m[0].length + 120);
      if (MONEY_MARK.test(win)) moneyHits.push({ line: lineOf(doc, s.start + m.index) });
    }
  }
  group(add, moneyHits, "TOFIXED-MONEY", "medium",
    (n) => `${n} money value(s) formatted with .toFixed() — currency placement, separators and numeral system are wrong outside your test locale`,
    'use Intl.NumberFormat(locale, { style: "currency", currency: "SAR" }).format(x) — the platform places the symbol and digits correctly (i18n §3)');

  // 6) PLURAL-GENERIC ("(s)" in visible text)
  const pluralHits = runs
    .filter((r) => /\b[A-Za-z]+\(\s*s\s*\)/.test(r.text))
    .map((r) => ({ line: r.line }));
  group(add, pluralHits, "PLURAL-GENERIC", "medium",
    (n) => `${n} visible string(s) use an "(s)" suffix — one plural shape for every count and language`,
    " Intl.PluralRules with a message key per category — Arabic distinguishes zero/one/two/few/many/other (i18n §4)");

  // 7) FIXED-WIDTH-TEXT (inline width:Npx on a text-bearing <button>/<a>)
  const inlineHits = [];
  for (const m of doc.matchAll(/<(?:button|a)\b[^>]*\bstyle\s*=\s*["'][^"']*\bwidth\s*:\s*\d+px[^>]*>/gi)) {
    if (/aria-hidden/i.test(m[0])) continue;
    inlineHits.push({ line: lineOf(doc, m.index) });
  }
  group(add, inlineHits, "FIXED-WIDTH-TEXT", "medium",
    (n) => `${n} control(s) with inline style width:Npx — if the control carries text, the label is guaranteed to clip in a longer locale`,
    "let padding + min-width size text controls; only icons/avatars get fixed widths (i18n §6)");

  // 8) FIXED-WIDTH-CSS-HINT (CSS: fixed px width on text-control-ish selectors)
  const HINT_RE = /(?:^|[\s,>+~.#])(?:[\w-]*-)?(?:btn|button|badge|chip|pill|tag|label)\b/i;
  const ICONISH_RE = /icon|logo|avatar|dot|arrow|brand|menu|nav|swatch|thumb|handle|toggle|knob|scroll|progress|caret|chevron|close|burger|input|select|textarea|color|range|slider|\bsvg\b|\bimg\b|\bpicture\b|\bcanvas\b|\bvideo\b|\biframe\b|\bpath\b|\bcircle\b|\brect\b/i;
  const cssHits = [];
  for (const st of styles) {
    for (const m of st.body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = m[1], body = m[2];
      if (!HINT_RE.test(sel) || ICONISH_RE.test(sel)) continue;
      if (/(?:^|[;{\s])width\s*:\s*\d+px/.test(body))
        cssHits.push({ line: lineOf(doc, st.start + m.index) });
    }
  }
  group(add, cssHits, "FIXED-WIDTH-CSS-HINT", "low",
    (n) => `${n} CSS rule(s) fix a px width on a button/badge/chip/tag/label-ish selector — if that control ever carries text it clips in other locales`,
    "size text controls with padding + min-width (or %/ch); keep fixed widths for icon-only selectors (i18n §6)");

  // 9) FONT-NOSUBSET (@font-face without unicode-range)
  const fontHits = [];
  for (const st of styles)
    for (const m of st.body.matchAll(/@font-face\s*\{[^}]*\}/g))
      if (!/unicode-range/i.test(m[0]))
        fontHits.push({ line: lineOf(doc, st.start + m.index) });
  group(add, fontHits, "FONT-NOSUBSET", "low",
    (n) => `${n} @font-face block(s) declare no unicode-range — every visitor downloads the full glyph set, and Arabic fonts are heavy`,
    "subset the font and declare unicode-range (or use a serving service that subsets automatically) — 60–80% smaller typically (i18n §5)");

  return findings;
}

// ---------- input collection ----------
function collectFiles(args) {
  const out = [];
  for (const a of args) {
    let st;
    try { st = statSync(a); } catch { console.error(`i18n: cannot read ${a}`); process.exit(2); }
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
    try { raw = readFileSync(f, "utf8"); } catch { console.error(`i18n: cannot read ${f}`); process.exit(2); }
    all.push(...auditFile(raw, f));
  }
  all.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.id.localeCompare(b.id));

  if (asJson) {
    console.log(JSON.stringify({ tool: "design-arsenal/i18n", files: files.length, findings: all }, null, 2));
  } else {
    for (const f of files) console.log(cyan(`\n▸ ${f}`));
    if (!all.length) console.log(green("  ✓ no i18n findings"));
    for (const f of all) {
      const tag = f.severity === "high" ? red("HIGH") : f.severity === "medium" ? yellow("MED ") : dim("LOW ");
      console.log(`  ${tag} ${bold(f.id)}  ${f.message}`);
      console.log(`      ${dim("fix:")} ${f.fix}`);
    }
    const high = all.filter((f) => f.severity === "high").length;
    const med = all.filter((f) => f.severity === "medium").length;
    const low = all.filter((f) => f.severity === "low").length;
    console.log(`\n${cyan("i18n:")} ${files.length} file(s) — ${high} HIGH, ${med} medium, ${low} low`);
  }
  return all.some((f) => f.severity === "high") ? 1 : 0;
}

// ---------- self-test ----------
function selfTest() {
  const BAD_HTML = `<!doctype html>
<html>
<head><title>bad</title>
<style>
.btn-cta { width: 120px; padding: 8px; font-size: .9rem; }
@font-face { font-family: "ArbF"; src: url(arb.woff2) format("woff2"); }
</style>
</head>
<body>
<p>مرحبًا بك في المتجر — لديك <span>3 item(s)</span> في السلة</p>
<a class="btn-cta" style="width: 96px">اشترِ الآن</a>
<script>
const price = 250;
const total = price.toFixed(2) + " ر.س";
const d = new Date();
const stamp = \`\${d.getFullYear()}/\${d.getMonth() + 1}/\${d.getDate()}\`;
const n = 1234.5;
console.log(n.toLocaleString("en-US"));
</script>
</body>
</html>`;

  const GOOD_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head><title>good</title>
<style>
.btn-cta { min-width: 120px; padding: 8px; }
@font-face { font-family: "ArbF"; src: url(arb.woff2) format("woff2"); unicode-range: U+0600-06FF, U+200C-200E, U+FB50-FDFF; }
</style>
</head>
<body>
<p>مراجعة <bdi>Sarah</bdi> — قبل ساعتين</p>
<p>السلة: <span id="count"></span></p>
<button type="button" class="btn-cta">أكمل الشراء</button>
<script>
const locale = document.documentElement.lang || "ar";
const nf = new Intl.NumberFormat(locale, { style: "currency", currency: "SAR" });
const df = new Intl.DateTimeFormat(locale, { dateStyle: "long", calendar: "islamic-umalqura" });
const pr = new Intl.PluralRules(locale);
const nfEG = new Intl.NumberFormat("ar-EG");
</script>
</body>
</html>`;

  const GUARD_HTML = `<!doctype html>
<html lang="en" dir="ltr">
<head><title>guard</title>
<style>
.icon-btn { width: 38px; height: 38px; }
.menu-item { width: 200px; }
</style>
</head>
<body>
<p>English only page with plain text and a small delay.</p>
<script>
const r = (0.5).toFixed(1);
const t = new Intl.NumberFormat().format(1234);
</script>
</body>
</html>`;

  const checks = [];
  const expect = (name, cond) => checks.push([name, cond]);
  const byId = (fs, id) => fs.filter((f) => f.id === id).length;

  const bad = auditFile(BAD_HTML, "bad.html");
  expect("BAD: LANG-MISSING fired (html without lang)", byId(bad, "LANG-MISSING") === 1);
  expect("BAD: ARABIC-NO-DIR fired (Arabic text, no dir)", byId(bad, "ARABIC-NO-DIR") === 1);
  expect("BAD: MANUAL-DATE fired (getFullYear template + /)", byId(bad, "MANUAL-DATE") === 1);
  expect("BAD: LOCALE-HARDCODED fired (toLocaleString en-US)", byId(bad, "LOCALE-HARDCODED") === 1);
  expect("BAD: TOFIXED-MONEY fired (toFixed + ر.س)", byId(bad, "TOFIXED-MONEY") === 1);
  expect("BAD: PLURAL-GENERIC fired (item(s) visible)", byId(bad, "PLURAL-GENERIC") === 1);
  expect("BAD: FIXED-WIDTH-TEXT fired (inline width on <a>)", byId(bad, "FIXED-WIDTH-TEXT") === 1);
  expect("BAD: FIXED-WIDTH-CSS-HINT fired (.btn-cta width:120px)", byId(bad, "FIXED-WIDTH-CSS-HINT") === 1);
  expect("BAD: FONT-NOSUBSET fired (@font-face, no unicode-range)", byId(bad, "FONT-NOSUBSET") === 1);

  const good = auditFile(GOOD_HTML, "good.html");
  expect("GOOD: zero findings (lang+dir, Intl everywhere, bdi, min-width, unicode-range)", good.length === 0);

  const guard = auditFile(GUARD_HTML, "guard.html");
  expect("GUARD: lang+dir page, no Arabic → no HIGH", byId(guard, "LANG-MISSING") === 0 && byId(guard, "ARABIC-NO-DIR") === 0);
  expect("GUARD: icon-ish selectors exempt from width hint (.icon-btn/.menu-item)", byId(guard, "FIXED-WIDTH-CSS-HINT") === 0);
  expect("GUARD: plain toFixed + locale-less Intl stay silent", byId(guard, "TOFIXED-MONEY") === 0 && byId(guard, "LOCALE-HARDCODED") === 0);
  expect("GUARD: no font-face → no subset finding; no (s) text → no plural finding", byId(guard, "FONT-NOSUBSET") === 0 && byId(guard, "PLURAL-GENERIC") === 0);

  let fails = 0;
  for (const [name, ok] of checks) {
    if (!ok) { console.log(red(`  ✗ ${name}`)); fails++; }
    else console.log(green(`  ✓ ${name}`));
  }
  if (fails) console.log(dim(`  [debug] BAD: ${bad.map((f) => f.id).join(", ")} | GOOD: ${good.map((f) => f.id).join(", ")} | GUARD: ${guard.map((f) => f.id).join(", ")}`));
  console.log(`\n${cyan("self-test:")} ${checks.length - fails}/${checks.length} checks passed`);
  if (fails) process.exit(1);
  process.exit(0);
}

// ---------- CLI ----------
const args = process.argv.slice(2);
if (args.includes("--self-test")) { selfTest(); }
else if (!args.length || args.some((a) => a === "-h" || a === "--help")) {
  console.log(`usage: node i18n.mjs <file.html|dir/> [...] [--json]
       node i18n.mjs --self-test`);
  process.exit(args.length ? 0 : 2);
} else {
  const asJson = args.includes("--json");
  const files = collectFiles(args.filter((a) => a !== "--json"));
  if (!files.length) { console.error("i18n: no .html files found"); process.exit(2); }
  process.exit(report(files, asJson));
}
