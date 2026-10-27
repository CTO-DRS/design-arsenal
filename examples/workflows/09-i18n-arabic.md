# مشيّة 09 — منتج عربي جاهز للتدويل من الصفر (i18n · v2.7.0)

منتج قائم بالعربية سيُطلق نسخة إنجليزية خلال شهر — والشيفرة مليئة بـ`toFixed` وقوالب تواريخ يدوية وسلاسل مضمومة. الهدف: جعل كل شاشة تستقبل أي لغة بلا إعادة بناء، مع بقاء الاتجاه والتايبوغرافيا العربية سليمة.

**الوحدات:** i18n (مالك البنية) · rtl-arabic (الاتجاه والعزل) · a11y (قارئات بلغة الصفحة) · verify (لقطات باللغتين) · web-vitals (خط عربي مقسّم = أداء).

---

## 1) الفحص الثابت أولًا — لا تخمين

```bash
node skills/i18n/scripts/i18n.mjs src/           # كل الصفحات دفعة واحدة
node skills/i18n/scripts/i18n.mjs src/checkout.html --json   # للمسار البرمجي
```

الناتج المتوقع لمنتج غير مُعدّ للتدويل:

- `HIGH LANG-MISSING` و`HIGH ARABIC-NO-DIR` — `<html>` بلا `lang` أو `dir`.
- `MED MANUAL-DATE` — قوالب `${d.getFullYear()}/${d.getMonth()+1}/…` في كل تقرير.
- `MED TOFIXED-MONEY` — `price.toFixed(2) + " ر.س"` في السلة والدفع.
- `MED LOCALE-HARDCODED` — `toLocaleString("en-US")` تبقّت من قالب أجنبي.
- `MED PLURAL-GENERIC` — نصوص `(s)` في السلة والإشعارات.
- `LOW FIXED-WIDTH-CSS-HINT` / `FONT-NOSUBSET` — أزرار بعرض ثابت وخط عربي كامل الحروف.

سجّل النتائج كقائمة أعمال مرقّمة — كل قاعدة لها إصلاح نمطي واحد يُطبَّع على المشروع كله.

## 2) الإعلان اللغوي من أول سطر

```html
<html lang="ar" dir="rtl">
```

- أي عنصر بلغة مختلفة يحمل `lang` خاصًا به (`<p lang="en">…`).
- المحتوى الخام المجهول الاتجاه: `dir="auto"`؛ والأسماء المدرجة: `<bdi>` (تفصيل العزل في `rtl-arabic`).

## 3) نقل التنسيق كله إلى `Intl` — ملف إعداد واحد

```js
// i18n.config — القرار المركزي الوحيد
export const LOCALE = document.documentElement.lang || "ar";
export const nfMoney = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "SAR" });
export const nfNum   = new Intl.NumberFormat(LOCALE);
export const dfLong  = new Intl.DateTimeFormat(LOCALE, { dateStyle: "long" });
export const rt      = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
```

ثم استبدال نمطي: كل `toFixed(2) + " ر.س"` ← `nfMoney.format(x)`؛ كل قالب تاريخ ← `dfLong.format(d)`؛ وكل لغة صلبة `'en-US'` ← `LOCALE`. القرارات الثقافية (التقويم، `hour12`، بداية الأسبوع) في الملف نفسه لا في الشاشات.

## 4) الجمع: ست فئات عربية لا شرط واحد

```js
const pr = new Intl.PluralRules(LOCALE);
const key = pr.select(n);        // zero/one/two/few/many/other
el.textContent = messages[`cart.items.${key}`].replace("%n", nfNum.format(n));
```

موارد `messages.ar.json` و`messages.en.json` بمفاتيح متطابقة — وزر `(s)` ينمحى من كل القوالب.

## 5) النص القابل للتوسع والخط

- إزالة كل `width: NNNpx` عن الأزرار والشارات (يُبقيها الفاحص مرئية كـ`LOW` حتى تُحل) ← `padding` + `min-width`.
- الخط العربي: `font-display: swap` + `unicode-range` (تقسيم) + fallback نظام — ويُعاد قياس الأداء (`webvitals.mjs`) لأن حجم الخط كان يخفي ارتدادًا.

## 6) البوابات الأخيرة

```bash
node skills/a11y/scripts/contrast.mjs --tokens tokens.json    # الزوجان في الثيمين
node skills/forms/scripts/forms.mjs src/                      # الحقول: inputmode/autocomplete
node skills/responsive/scripts/responsive.mjs src/            # السوائل بعد توسيع النصوص
```

- قارئ شاشة **بالعربية** (NVDA/VoiceOver) — `lang` الصحيح يجعل النطق عربيًا لا مُتممًا حرفًا حرفًا.
- كتابة `٠٥٥` في الجوال وOTP تُقبل وتُحوَّل — لا رفض لمستخدم لوحته عربية.

## 7) التحقق البصري النهائي

```bash
# لقطات: عربي/إنجليزي × فاتح/داكن × 320px
playwright-cli screenshot --viewport-size=320,860 src/checkout.html
```

- المصفوفة كاملة في `skills/i18n/MANUAL.md §10` — وأهم سطرين: **أطول لغة عند 320px** و**الاسم المدرج لا يُقلب**.
- `i18n.mjs` يعود بصفر HIGH قبل السماح بالدمج — ثم تُغلَّف النسخة الثانية بلغة الواجهة الجديدة وتُعاد المصفوفة.
