# مشيّة 07 — نموذج تسجيل وصولي عربي من الصفر (forms · v2.5.0)

**المهمة:** «ابنِ نموذج تسجيل حساب جديد بالعربية — بريد وجوال ورمز تحقق — أريده وصوليًا حقًا لا شكليًا، وبلا placeholder-كتسمية.»

**الوحدات:** `forms` (قيادة) + `rtl-arabic` + `tokens` + `a11y` + `verify`.

## الخطوة 1 — اقرأ دليل الوحدة ثم ابنِ العقد (forms §1/§2)

```bash
# قبل كتابة أي <input>: اقرأ الدليل
cat skills/forms/MANUAL.md
```

البنية العقدية: كل حقل ثلاثيّة مكتملة — `<label for>` حقيقية، و`name` يُرسل، ونوع صحيح يجلب اللوحة الصحيحة على الجوال:

```html
<label for="em">البريد الإلكتروني</label>
<input type="email" id="em" name="email" autocomplete="email" dir="ltr" required>

<label for="ph">رقم الجوال</label>
<input type="tel" id="ph" name="phone" autocomplete="tel" dir="ltr">

<label for="otp">رمز التحقق</label>
<input type="text" id="otp" name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="8">
```

لاحظ: الـplaceholder — إن استُخدم — مثال قيمة («05xxxxxxxx») لا وصف؛ والوصف الحقيقي في `<label>`.

## الخطوة 2 — طبقة الاتجاه العربي (rtl-arabic §1/§4)

- الصفحة `dir="rtl"` — والحقول التقنية (بريد/جوال/رمز) `dir="ltr"`: يُكتب البريد سليمًا والمؤشر يتحرك منطقيًا.
- أي قيمة مستخدمة تُعرض في رسالة لاحقة تُلف بـ`<bdi>` فلا تُشوَّه الأسماء اللاتينية.
- لا `letterspacing` على العربية إطلاقًا، والمحاذاة بالخصائص المنطقية (`margin-inline-start`).

## الخطوة 3 — الرموز قبل الألوان (tokens §3 بإشراف forms §8)

```css
/* من ملف الرموز — لا hex داخل النموذج */
.field { background: var(--field-bg); border: 1px solid var(--field-border); }
.field[aria-invalid="true"] { border-color: var(--field-border-error); }
.field:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.msg-error { color: var(--color-danger); }
```

ثم فاحص الثيمات يطلب النظائر الداكنة لهذه الرموز كلها — النموذج يُختبر في الثيمين معًا:

```bash
node skills/dark-mode/scripts/theme.mjs --tokens tokens.light.json --dark tokens.dark.json
```

## الخطوة 4 — التحقق والإتاحة (forms §3/§4 + a11y §5)

- قيود أصلية أولًا: `required` + `type` + `pattern` — تعمل بلا JS.
- تحقق مخصص (إن لزم) ⇒ `novalidate` + منطقة حيّة واحدة للملخص + ربط كل خطأ بحقله:

```html
<div role="alert" id="errsum" hidden></div>
<!-- وعلى كل حقل فاشل: -->
<input ... aria-invalid="true" aria-describedby="em-err">
<p id="em-err" class="msg-error">أدخل بريدًا صحيحًا مثل name@example.com</p>
```

- زر إرسال حقيقي `<button type="submit">` مع قفل الإرسال المزدوج (`aria-busy="true"` أثناء الطلب).
- أهداف لمس ≥44px لكل المربعات والاختيارات (WCAG 2.5.8).

## الخطوة 5 — بوابة الفاحص الثابتة قبل المتصفح

```bash
node skills/forms/scripts/forms.mjs src/signup.html
# ✓ no forms findings        ← مطلوب: صفر HIGH على الأقل قبل المتابعة
```

لو ظهرت `LABEL-MISSING` أو `NAME-MISSING` فهي HIGH: أصلحها قبل أي جماليات — ثم أعِد الفحص حتى الصفر.

## الخطوة 6 — بوابة التسليم (verify)

```bash
# لقطات للثيمين والاتجاهين + جولة لوحة مفاتيح كاملة (Tab/Enter)
playwright-cli open src/signup.html   # ثم: screenshot لكل حالة
```

قائمة التسليم: لوحة مفاتيح كاملة، قارئ شاشة يعلن كل حقل بخطئه، JS مطفأ = القيود الأصلية تعمل، ثيمان بتباين مجتاز، إرسال مزدوج مستحيل، و`forms.mjs` صفر findings.
