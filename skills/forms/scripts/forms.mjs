#!/usr/bin/env node
/**
 * forms.mjs — static forms/inputs linter for design-arsenal (forms module).
 * Zero dependencies. Node 18+.
 *
 * Usage:
 *   node forms.mjs page.html              audit one HTML file (text report)
 *   node forms.mjs page.html other.html   audit several files (dirs: depth 1)
 *   node forms.mjs src/ --json            machine-readable findings
 *   node forms.mjs --self-test            embedded fixtures, exit 0/1
 *
 * What it catches (static, structural — not a live interaction test):
 *   HIGH LABEL-MISSING         control without any label association (label/for,
 *                              wrapping label, aria-label/labelledby, title)
 *   HIGH NAME-MISSING         control inside a <form> without name= — it will
 *                              never submit (standalone JS-driven controls exempt)
 *   MED  PLACEHOLDER-AS-LABEL  placeholder doing the label's job
 *   MED  AUTOCOMPLETE-MISSING  email/tel/url field without standard autocomplete
 *   MED  NOVALIDATE-NO-LIVE    form[novalidate] but no aria-live/alert region
 *                              for the custom errors it implies
 *   MED  NO-SUBMIT             form with no actual submit control
 *   LOW  INPUTMODE-HINT        OTP/code field without inputmode="numeric"
 *   LOW  ARIA-REQUIRED-MISMATCH  aria-required="true" without native required
 *   LOW  BIDI-FIELD            email/tel/url field without dir="ltr" on an RTL page
 *   LOW  FILE-NO-ACCEPT        file input without accept filter
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
// numbers stay faithful (attribute logic never needs script content).
function blankComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
}
function prepare(raw) {
  let doc = blankComments(raw);
  doc = doc.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi,
    (m, open, body, close) => open + body.replace(/[^\n]/g, " ") + close);
  return doc;
}
const lineOf = (doc, idx) => doc.slice(0, idx).split("\n").length;

// ---------- attribute helpers (word-boundary safe; never matches aria-required for required) ----------
function getAttr(tag, name) {
  const re = new RegExp(`(?<![\\w-])${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? "").replace(/^["']|["']$/g, "");
}
function hasAttr(tag, name) {
  return new RegExp(`(?<![\\w-])${name}(?![\\w-])`, "i").test(tag);
}

// Controls that never need a label/name: hidden, and the button-like inputs.
const SKIP_TYPES = new Set(["hidden", "submit", "button", "reset", "image"]);
const controlType = (tag) => (getAttr(tag, "type") || "text").toLowerCase();
const isControl = (tag) => !SKIP_TYPES.has(controlType(tag));

// ---------- label association ----------
function labelForIds(doc) {
  const set = new Set();
  for (const m of doc.matchAll(/<label\b[^>]*>/gi)) {
    const v = getAttr(m[0], "for");
    if (v) set.add(v);
  }
  return set;
}
function labelRanges(doc) {
  const ranges = [];
  const stack = [];
  const tokens = [...doc.matchAll(/<label\b[^>]*>|<\/label\s*>/gi)];
  for (const t of tokens) {
    if (t[0].startsWith("</")) {
      const open = stack.pop();
      if (open !== undefined) ranges.push([open, t.index]);
    } else {
      stack.push(t.index);
    }
  }
  return ranges;
}
const inRanges = (ranges, idx) => ranges.some(([a, b]) => idx >= a && idx <= b);

// ---------- grouped finding helper ----------
// Groups N occurrences of one rule into a single finding with a count + lines.
function group(add, doc, hits, id, severity, messageFn, fix) {
  if (!hits.length) return;
  add(id, severity, messageFn(hits.length, hits[0].tag), fix,
    [...new Set(hits.map((h) => h.line))].slice(0, 3));
}

// ---------- audit for one file ----------
function auditFile(raw, file) {
  const doc = prepare(raw);
  const findings = [];
  const add = (id, severity, message, fix, lines = []) =>
    findings.push({ id, severity, message, fix, file, lines });

  const controls = [...doc.matchAll(/<(input|select|textarea)\b[^>]*?\/?>/gi)]
    .map((m) => ({ tag: m[0], idx: m.index, line: lineOf(doc, m.index) }));
  const usable = controls.filter((c) => {
    if (c.tag.toLowerCase().startsWith("<input") && !isControl(c.tag)) return false;
    return true;
  });

  const forIds = labelForIds(doc);
  const ranges = labelRanges(doc);
  const formRanges = (() => {
    const rs = [];
    const stack = [];
    for (const t of doc.matchAll(/<form\b[^>]*>|<\/form\s*>/gi)) {
      if (t[0].startsWith("</")) {
        const open = stack.pop();
        if (open !== undefined) rs.push([open, t.index]);
      } else stack.push(t.index);
    }
    return rs;
  })();
  const hasLabelAssoc = (c) => {
    const tag = c.tag;
    if (hasAttr(tag, "aria-label") || hasAttr(tag, "aria-labelledby") || hasAttr(tag, "title")) return true;
    const id = getAttr(tag, "id");
    if (id && forIds.has(id)) return true;
    if (inRanges(ranges, c.idx)) return true;
    return false;
  };

  if (usable.length) {
    // 1) LABEL-MISSING / PLACEHOLDER-AS-LABEL (mutually exclusive per control)
    const noLabelNoPh = [], noLabelPh = [];
    for (const c of usable) {
      if (hasLabelAssoc(c)) continue;
      if (getAttr(c.tag, "placeholder")) noLabelPh.push(c); else noLabelNoPh.push(c);
    }
    group(add, doc, noLabelNoPh, "LABEL-MISSING", "high",
      (n) => `${n} control(s) with no label association (no <label for>, wrapping <label>, aria-label or title) — screen readers announce an unnamed field`,
      "give every control a real <label for=\"id\"> (or a wrapping label / aria-label); placeholders are examples, never labels (forms §2)",
      );
    group(add, doc, noLabelPh, "PLACEHOLDER-AS-LABEL", "medium",
      (n) => `${n} control(s) rely on placeholder as the only label — it vanishes on input and reads poorly`,
      "add a real <label for=\"id\"> and demote the placeholder to a value example (forms §2)",
      );

    // 2) NAME-MISSING — only inside <form>: standalone JS-driven controls don't submit
    const noName = usable.filter((c) =>
      !getAttr(c.tag, "name") && inRanges(formRanges, c.idx));
    group(add, doc, noName, "NAME-MISSING", "high",
      (n) => `${n} control(s) inside <form> without name= — the browser will never send their value with the form`,
      "add name=\"...\" to every submitting control (forms §2)");

    // 3) AUTOCOMPLETE-MISSING — email/tel/url (by type or name/id hint)
    const ident = usable.filter((c) => {
      if (!c.tag.toLowerCase().startsWith("<input")) return false;
      const t = controlType(c.tag);
      const named = `${getAttr(c.tag, "name") || ""} ${getAttr(c.tag, "id") || ""}`.toLowerCase();
      const looksIdent = ["email", "tel", "url"].includes(t) || /e-?mail|phone|mobile|\btel\b/.test(named);
      return looksIdent && !hasAttr(c.tag, "autocomplete");
    });
    group(add, doc, ident, "AUTOCOMPLETE-MISSING", "medium",
      (n) => `${n} identity/contact field(s) without autocomplete — loses browser autofill and fails WCAG 1.3.5 intent`,
      "add the standard token: autocomplete=\"email\" / \"tel\" / \"url\" (forms §2)");

    // 4) NOVALIDATE-NO-LIVE
    const nv = [...doc.matchAll(/<form\b[^>]*>/gi)].some((m) => hasAttr(m[0], "novalidate"));
    const hasLive = /aria-live|role\s*=\s*["'](alert|status)["']/i.test(doc);
    if (nv && !hasLive)
      add("NOVALIDATE-NO-LIVE", "medium",
        "form uses novalidate (custom validation) but the page has no aria-live / role=alert region — custom errors will never be announced",
        "add a live region for the error summary and wire aria-invalid + aria-describedby per field (forms §3/§4)");

    // 5) NO-SUBMIT
    const forms = [...doc.matchAll(/<form\b[^>]*>/gi)];
    if (forms.length) {
      const buttons = [...doc.matchAll(/<button\b[^>]*>/gi)];
      const hasSubmit =
        buttons.some((b) => {
          const t = getAttr(b[0], "type");
          return t === null || t.toLowerCase() === "submit"; // untyped <button> defaults to submit
        }) ||
        controls.some((c) => c.tag.toLowerCase().startsWith("<input") && controlType(c.tag) === "submit");
      if (!hasSubmit)
        add("NO-SUBMIT", "medium",
          "form(s) exist but no submit control — every button is type=\"button\" (or there are none), so Enter/submit sends nothing",
          "add <button type=\"submit\">…</button> or <input type=\"submit\"> (forms §4)");
    }

    // 6) INPUTMODE-HINT — OTP/code/pin fields
    const otp = usable.filter((c) => {
      if (!c.tag.toLowerCase().startsWith("<input")) return false;
      const named = `${getAttr(c.tag, "name") || ""} ${getAttr(c.tag, "id") || ""} ${getAttr(c.tag, "autocomplete") || ""}`.toLowerCase();
      if (!/otp|one-?time|code|pin/.test(named)) return false;
      const t = controlType(c.tag);
      if (!["text", "number"].includes(t)) return false;
      return !hasAttr(c.tag, "inputmode");
    });
    group(add, doc, otp, "INPUTMODE-HINT", "low",
      (n) => `${n} verification-code field(s) without inputmode="numeric" — desktop- keyboard on mobile for a digits-only value`,
      "add inputmode=\"numeric\" (and pattern=/^[0-9]*$/ as fits) — avoid type=\"number\" for OTP (forms §5)");

    // 7) ARIA-REQUIRED-MISMATCH
    const ariareq = usable.filter((c) =>
      /^true$/i.test(getAttr(c.tag, "aria-required") || "") && !hasAttr(c.tag, "required"));
    group(add, doc, ariareq, "ARIA-REQUIRED-MISMATCH", "low",
      (n) => `${n} control(s) declare aria-required="true" without native required — two sources of truth drift apart`,
      "use the native required attribute (it implies the ARIA semantics); keep aria-required only where required is impossible (forms §3)");

    // 8) BIDI-FIELD — technical fields on an RTL page
    const rtlPage = /<(html|body)\b[^>]*dir\s*=\s*["']rtl["']/i.test(doc);
    if (rtlPage) {
      const bidi = usable.filter((c) =>
        c.tag.toLowerCase().startsWith("<input") &&
        ["tel", "email", "url"].includes(controlType(c.tag)) &&
        !hasAttr(c.tag, "dir"));
      group(add, doc, bidi, "BIDI-FIELD", "low",
        (n) => `${n} LTR-nature field(s) (tel/email/url) inherit dir="rtl" — addresses and numbers get visually scrambled while typing`,
        "add dir=\"ltr\" to tel/email/url inputs on RTL pages (keep the label RTL) (forms §5)");
    }

    // 9) FILE-NO-ACCEPT
    const files = usable.filter((c) =>
      c.tag.toLowerCase().startsWith("<input") && controlType(c.tag) === "file" && !hasAttr(c.tag, "accept"));
    group(add, doc, files, "FILE-NO-ACCEPT", "low",
      (n) => `${n} file input(s) without accept — users upload unsupported files and discover the rejection after upload`,
      "add accept=\"...\" (e.g. .pdf,image/*) matched to what the server actually accepts (forms §2)");
  }

  return findings;
}

// ---------- input collection ----------
function collectFiles(args) {
  const out = [];
  for (const a of args) {
    let st;
    try { st = statSync(a); } catch { console.error(`forms: cannot read ${a}`); process.exit(2); }
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
    try { raw = readFileSync(f, "utf8"); } catch { console.error(`forms: cannot read ${f}`); process.exit(2); }
    all.push(...auditFile(raw, f));
  }
  all.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.id.localeCompare(b.id));

  if (asJson) {
    console.log(JSON.stringify({ tool: "design-arsenal/forms", files: files.length, findings: all }, null, 2));
  } else {
    for (const f of files) console.log(cyan(`\n▸ ${f}`));
    if (!all.length) console.log(green("  ✓ no forms findings"));
    for (const f of all) {
      const tag = f.severity === "high" ? red("HIGH") : f.severity === "medium" ? yellow("MED ") : dim("LOW ");
      console.log(`  ${tag} ${bold(f.id)}  ${f.message}`);
      console.log(`      ${dim("fix:")} ${f.fix}`);
    }
    const high = all.filter((f) => f.severity === "high").length;
    const med = all.filter((f) => f.severity === "medium").length;
    const low = all.filter((f) => f.severity === "low").length;
    console.log(`\n${cyan("forms:")} ${files.length} file(s) — ${high} HIGH, ${med} medium, ${low} low`);
  }
  return all.some((f) => f.severity === "high") ? 1 : 0;
}

// ---------- self-test ----------
function selfTest() {
  const BAD_HTML = `<!doctype html><html lang="ar" dir="rtl"><head><title>bad</title></head>
<body><form action="/signup">
  <input type="email" placeholder="البريد الإلكتروني">
  <input type="tel" name="phone">
  <input type="text" name="otp" id="otp"><label for="otp">رمز التحقق</label>
  <select id="city"><option value="1">الرياض</option></select>
  <textarea aria-label="ملاحظات"></textarea>
  <input type="text" name="nick" aria-required="true"><label for="nick">الكنية</label>
  <input type="file" name="cv" aria-label="سيرتك">
  <input type="text" name="fullname" id="fullname" required><label for="fullname">الاسم</label>
  <button>إرسال</button>
</form></body></html>`;

  const NOVAL_HTML = `<!doctype html><html><body>
<form action="/x" novalidate><input type="text" name="a" id="a"><label for="a">حقل</label>
<button type="submit">اذهب</button></form></body></html>`;

  const NOSUB_HTML = `<!doctype html><html><body>
<form action="/x"><input type="text" name="a"><button type="button">إلغاء</button></form></body></html>`;

  const GOOD_HTML = `<!doctype html><html lang="ar" dir="rtl"><head><title>good</title></head>
<body>
<form action="/signup" method="post">
  <label for="em">البريد الإلكتروني</label>
  <input type="email" id="em" name="email" autocomplete="email" dir="ltr" required>
  <label for="ph">رقم الجوال</label>
  <input type="tel" id="ph" name="phone" autocomplete="tel" dir="ltr">
  <label for="otp">رمز التحقق</label>
  <input type="text" id="otp" name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*">
  <label for="nm">الاسم الكامل</label>
  <input type="text" id="nm" name="fullname" autocomplete="name" required>
  <fieldset><legend>طريقة التواصل المفضلة</legend>
    <label><input type="radio" name="pref" value="email"> بريد</label>
    <label><input type="radio" name="pref" value="sms"> رسالة</label>
  </fieldset>
  <label for="ct">المدينة</label>
  <select id="ct" name="city"><option value="1">الرياض</option></select>
  <label for="nt">ملاحظات</label>
  <textarea id="nt" name="notes" dir="auto"></textarea>
  <label for="cv">السيرة الذاتية</label>
  <input type="file" id="cv" name="cv" accept=".pdf,.doc,.docx">
  <div role="alert" id="errsum" hidden></div>
  <button type="submit">إنشاء الحساب</button>
</form>
<form action="/search" role="search">
  <input type="search" name="q" aria-label="ابحث في الموقع">
  <button type="submit">ابحث</button>
</form>
</body></html>`;

  const HID = `<input type="hidden" name="csrf" value="x">`;
  const STANDALONE = `<!doctype html><html><body>
  <label for="pick">اختر لونًا</label><input type="color" id="pick" value="#565d66">
  </body></html>`;

  const checks = [];
  const expect = (name, cond) => checks.push([name, cond]);
  const byId = (fs, id) => fs.filter((f) => f.id === id).length;

  const bad = auditFile(BAD_HTML, "bad.html");
  expect("BAD: PLACEHOLDER-AS-LABEL fired (email with placeholder only)", byId(bad, "PLACEHOLDER-AS-LABEL") === 1);
  expect("BAD: LABEL-MISSING fired (tel + select + nick-without-id = 3 controls)", byId(bad, "LABEL-MISSING") === 1 && /3 control/.test(bad.find((f) => f.id === "LABEL-MISSING").message));
  expect("BAD: NAME-MISSING fired (email + select + textarea = 3 controls)", byId(bad, "NAME-MISSING") === 1 && /3 control/.test(bad.find((f) => f.id === "NAME-MISSING").message));
  expect("BAD: AUTOCOMPLETE-MISSING fired (email + tel)", byId(bad, "AUTOCOMPLETE-MISSING") === 1 && /2 identity/.test(bad.find((f) => f.id === "AUTOCOMPLETE-MISSING").message));
  expect("BAD: INPUTMODE-HINT fired (otp)", byId(bad, "INPUTMODE-HINT") === 1);
  expect("BAD: ARIA-REQUIRED-MISMATCH fired (nick)", byId(bad, "ARIA-REQUIRED-MISMATCH") === 1);
  expect("BAD: BIDI-FIELD fired (email + tel, no dir on RTL page)", byId(bad, "BIDI-FIELD") === 1 && /2 LTR-nature/.test(bad.find((f) => f.id === "BIDI-FIELD").message));
  expect("BAD: FILE-NO-ACCEPT fired (cv)", byId(bad, "FILE-NO-ACCEPT") === 1);
  expect("BAD: NO-SUBMIT silent (untyped button is a submit)", byId(bad, "NO-SUBMIT") === 0);
  expect("BAD: NOVALIDATE-NO-LIVE silent (no novalidate)", byId(bad, "NOVALIDATE-NO-LIVE") === 0);

  const noval = auditFile(NOVAL_HTML, "noval.html");
  expect("NOVAL: NOVALIDATE-NO-LIVE fired", byId(noval, "NOVALIDATE-NO-LIVE") === 1);
  expect("NOVAL: NO-SUBMIT silent (type=submit present)", byId(noval, "NO-SUBMIT") === 0);

  const nosub = auditFile(NOSUB_HTML, "nosub.html");
  expect("NOSUB: NO-SUBMIT fired (only type=button)", byId(nosub, "NO-SUBMIT") === 1);

  const good = auditFile(GOOD_HTML, "good.html");
  expect("GOOD: zero findings (labels, names, autocomplete, bidi, wrapping radio labels, aria-label search)", good.length === 0);

  const hid = auditFile(HID, "h.html");
  expect("GUARD: hidden input ignored (no label/name findings)", byId(hid, "LABEL-MISSING") === 0 && byId(hid, "NAME-MISSING") === 0);

  const stand = auditFile(STANDALONE, "standalone.html");
  expect("GUARD: standalone JS-driven control exempt from NAME-MISSING (still needs a label)",
    byId(stand, "NAME-MISSING") === 0 && byId(stand, "LABEL-MISSING") === 0);

  let fails = 0;
  for (const [name, ok] of checks) {
    if (!ok) { console.log(red(`  ✗ ${name}`)); fails++; }
    else console.log(green(`  ✓ ${name}`));
  }
  if (fails) console.log(dim(`  [debug] BAD: ${bad.map((f) => f.id).join(", ")} | GOOD: ${good.map((f) => f.id).join(", ")}`));
  console.log(`\n${cyan("self-test:")} ${checks.length - fails}/${checks.length} checks passed`);
  if (fails) process.exit(1);
  process.exit(0);
}

// ---------- CLI ----------
const args = process.argv.slice(2);
if (args.includes("--self-test")) { selfTest(); }
else if (!args.length || args.some((a) => a === "-h" || a === "--help")) {
  console.log(`usage: node forms.mjs <file.html|dir/> [...] [--json]
       node forms.mjs --self-test`);
  process.exit(args.length ? 0 : 2);
} else {
  const asJson = args.includes("--json");
  const files = collectFiles(args.filter((a) => a !== "--json"));
  if (!files.length) { console.error("forms: no .html files found"); process.exit(2); }
  process.exit(report(files, asJson));
}
