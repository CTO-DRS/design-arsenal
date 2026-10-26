# المشيّة 2 — لوحة تحكم عربية RTL كاملة

**المهمة:** «ابنِ لوحة تحكم عربية بالكامل لإدارة متجر إلكتروني: مبيعات اليوم، طلبات قيد المعالجة، مخزون منخفض، وجدول طلبات قابل للفرز. يجب أن تكون متوافقة مع WCAG.»

**الوحدات المستخدمة:** `rtl-arabic` (طبقة سياق دائمة) + `tokens` → `taste --app` → `components` → `a11y` → `verify`

**القاعدة الحرجة:** المحتوى عربي ⇒ اقرأ `skills/rtl-arabic/MANUAL.md` **قبل كتابة أي سطر CSS**، وكل ما تبقى يمر من فوقها لا حولها.

---

## الخطوة 1 — rtl-arabic: أساس الاتجاه والخط

1. `<html lang="ar" dir="rtl">` — مرة واحدة، لا `dir` متفرقة في الشجرة.
2. خصائص منطقية فقط: `margin-inline-start`، `text-align: start`، `inset-inline-end`. فحص سريع: `rg "(margin|padding|border)-(left|right)" src/` يجب أن يعيد صفرًا.
3. الخط: **IBM Plex Sans Arabic** للواجهة (ارتفاع سطر 1.8 للنصوص، **لا letterspacing أبدًا** على العربية).
4. الأرقام: KPIs المالية بأرقام غربية داخل جزر `dir="ltr"`؛ التواريخ بالعربية في الجدول؛ العملة `ر.س` بعد الرقم في النص، `SAR` في جداول البيانات.
5. أيقونات السهم/الشرير تُقلب بـ`[dir="rtl"] .icon-chev { transform: scaleX(-1) }` — لكن لا تقلب الساعة أو الكاميرا أو البحث.

## الخطوة 2 — tokens: نظام الألوان قبل المكوّنات

اقرأ `skills/design-tokens/MANUAL.md`. أنشئ `tokens.json` بطبقتين (primitive + semantic) وثيمين:

```bash
# light + dark بذوم أسماء دلالية واحدة
node skills/a11y/scripts/contrast.mjs --tokens light.tokens.json   # ✓
node skills/a11y/scripts/contrast.mjs --tokens dark.tokens.json    # ✓
node skills/design-tokens/scripts/convert.mjs light.tokens.json --to css > themes/light.css
node skills/design-tokens/scripts/convert.mjs dark.tokens.json  --to css > themes/dark.css
```

قاعدة الثيم الداكن: أسطح ترتفع فتفتح (`#121212` ← `#1E1E1E`)، نص `#E6E6E6` لا `#FFF` نقي.

## الخطوة 3 — بناء الشاشة (عقلية app-screen لا landing)

اقرأ `skills/taste/MANUAL.md` + قسم app-screens فيه: حدود هادئة، لوحات متكررة طبيعية هنا، بلا تدرجات ولا أيقونات داخل مربعات ملونة ولا رسوم قوس قزح. جدول الطلبات: `<table>` حقيقي مع `<th scope>`، أعمدة البيانات تبقى بترتيب منطقي (الأرقام لا تنعكس)، الفرز بأزرار رأس جدول حقيقية مع `aria-sort`.

حيث ناسب مكوّن من `components` (كشف الاسم في `catalog.json` أولًا) انسخه من `ts-default/` واضبط خصائصه بخصائص منطقية.

## الخطوة 4 — a11y: بوابات الإتاحة على الشاشة كلها

اقرأ `skills/a11y/MANUAL.md` وطبّق على لوحة التحكم تحديدًا:

- عناصر KPI: `<dl>` دلالي (قائمة تعريفات) لا `div` متتالية.
- جدول الطلبات: رأس جدول مرتبط (`scope`)، حالة الفرز في `aria-sort` على `<th>`.
- تنبيه «مخزون منخفض»: منطقة حية `role="status"` موجودة مسبقًا تُحدَّث نصيًا.
- التنقل بالكيبورد: Tab يمر بالسايدبار ثم الشاشة، رابط تخطي إلى `#main`، حلقة تركيز داخل أي مودال.
- كل نص فوق سطح: 4.5:1 مؤكد بسكربت الخطوة 2 (لا استثناء لشارات الحالة — استخدم نصًا غامقًا لا رماديًا فاتحًا).

## الخطوة 5 — verify: لقطة الحكم النهائية

اقرأ `skills/playwright-cli/MANUAL.md`:

```bash
playwright-cli open http://localhost:3000/dashboard
playwright-cli screenshot --viewport 1440x900 rtl-dashboard.png
```

افحص اللقطة بحثًا عن: نص عربي + أرقام + اسم منتج Latin في سطر واحد (اختبار bdi)، أيقونة سهم غير مقلوبة، نص مقصوص عند حافة البطاقة، تداخل تشكيل مع السطر السابق. أصلح وأعد حتى تنقشع.

**النتيجة النهائية:** لوحة تحكم عربية أصيلة (لا «معرّبة»)، بثيمين مفحوصين، جدول مُعلن صحيحًا لقارئ الشاشة، وتجاوز كامل بالكيبورد.
