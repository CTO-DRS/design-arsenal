# المشيّة 1 — من لقطة شاشة إلى صفحة هبوط مكتملة

**المهمة:** «هذه لقطة لتطبيق لياقة أحبه — ابنِ لي صفحة هبوط بنفس الروح، لا تشبه القوالب، ومتجاوبة بالكامل.»

**الوحدات المستخدمة (بالترتيب):** `tokens` → `taste` → `components` → `motion/transitions` → `polish` → `a11y` → `verify`

**لماذا هذا الترتيب؟** اللقطة مدخل تصميم قائم فنستهلكه برموز أولًا، ثم نوجه بناءً جديدًا بـtaste، ثم نبني ونحرّك، ونغلق ببوابات الجودة والتحقق.

---

## الخطوة 1 — tokens: حوّل اللقطة إلى معمارية رموز

اقرأ `skills/design-tokens/MANUAL.md` ثم:

1. جرد بصري للقطة: سطحان للخلفية، لون إجراء واحد (برتقالي نشط)، درجتا ظل، تدرج نصي من 6 أحجام، شبكة 8px.
2. طبّع القيم إلى primitives (تدرج 50→950) ثم سمِّ الطبقة الدلالية:

```json
{
  "color": {
    "bg":      { "$type": "color", "$value": "{color.gray.50}" },
    "surface": { "$type": "color", "$value": "#FFFFFF" },
    "fg":      { "$type": "color", "$value": "{color.gray.900}" },
    "fg-muted":{ "$type": "color", "$value": "{color.gray.500}" },
    "action":  { "$type": "color", "$value": "{color.orange.600}" },
    "fg-on-action": { "$type": "color", "$value": "#FFFFFF" }
  },
  "space": { "1": {"$type":"dimension","$value":"8px"}, "2": {"$type":"dimension","$value":"16px"}, "3": {"$type":"dimension","$value":"24px"} }
}
```

3. افحص قبل أي CSS:

```bash
node skills/a11y/scripts/contrast.mjs --tokens tokens.json
# ✗ color.fg-muted on color.bg → 4.1:1  ← غامّق gray.500 إلى 600 وأعد الفحص حتى ✓
```

4. صدّر لبيئة المشروع:

```bash
node skills/design-tokens/scripts/convert.mjs tokens.json --to tailwind4 > app.css
```

**النتيجة:** `tokens.json` + ورقة CSS/`@theme` مولدة، وصفر hex داخل المكوّنات لاحقًا.

## الخطوة 2 — taste: الاتجاه الفني قبل الكود

اقرأ `skills/taste/MANUAL.md`. شغّل `node skills/taste/scripts/draw.mjs` واختر من الاتجاهات الثلاثة المعروضة الاتجاه الحامل لفكرة اللياقة (مثال: «الحركة كخط أساس» — صور كاملة العرض، تايبوغرافي أسود ثقيل، مساحات بيضاء كثيفة). طبّق الحظر: لا صف بطاقات أيقونات متساوية، لا تدرج بنفسجي-أزرق افتراضي، لا placeholder نسخ.

## الخطوة 3 — بناء + مكوّنات

ابنِ الأقسام (Hero، برامج التدريب، شهادات، تسعير خفيف، CTA). حيث ناسب:

- انسخ مكوّنًا من `skills/react-bits/ts-tailwind/` (مثل تأثير نصي متحرك للعنوان) — **تحقق من الاسم في `catalog.json` قبل أي شيء**.
- انتقالات صغيرة من `skills/transitions/transitions-dev/MANUAL.md`: توست نجاح الاشتراك + skeleton للقسم المتأخر التحميل، مع حارس `prefers-reduced-motion` لكل مقطع.

## الخطوة 4 — polish: الصقل قبل التسليم

اقرأ `skills/impeccable/MANUAL.md` ثم:

```text
/impeccable polish src/landing/
/impeccable audit src/landing/
```

عالج النتائج (البطاقات المتداخلة، الرمادي على اللون، التباعد غير الشبكي) وأعد الفحص حتى ينضف التقرير.

## الخطوة 5 — a11y + verify: البوابات الأخيرة

اقرأ `skills/a11y/MANUAL.md` ومرّر التدقيق الـ12 نقطة (تباين ✓ من الخطوة 1، زر لا div، تركيز مرئي، نماذج موسومة…). ثم اقرأ `skills/playwright-cli/MANUAL.md`:

```bash
playwright-cli open http://localhost:3000
playwright-cli screenshot --viewport 1440x900 landing-desktop.png
playwright-cli screenshot --viewport 390x844  landing-mobile.png
```

راجع اللقطتين بعين محكّم: بلا قصّ نصوص عند 390px، وبلا تداخل طبقات.

**النتيجة النهائية:** صفحة هبوط بروح اللقطة، رموزها مفحوصة التباين، حركتها محمية، ومدققة بصريًا على مقاسين.
