# مشيّة 06 — تخطيط متجاوب سيّال على كل الشاشات (responsive · v2.4.0)

**المهمة:** «الصفحة تنكسر على الجوال ويظهر تمرير أفقي — اجعلها متجاوبة حقًا، لا ترقيعًا باستعلامات مضاعفة.»

**الوحدات:** `responsive` (قيادة) + `a11y` (بوابة التكبير) + `web-vitals` (تكلفة الوسائط) + `verify` (لقطات متعددة النوافذ).

---

## الخطوة 1 — تشخيص ثابت قبل أي تعديل (لا تخمين)

```bash
node skills/responsive/scripts/responsive.mjs src/ 
# رمز الخروج 1 = بوابة فاشلة (يوجد HIGH)
```

مخرجات حقيقية متوقعة على صفحة مكسورة:

- `VIEWPORT-MISSING` (HIGH) — لا meta viewport: الهاتف يفترض 980px ويصغّر كل شيء.
- `PX-ROOT-FONT` (HIGH) — `html { font-size: 16px }` يكسر تكبير المستخدم وسلّم rem.
- `FIXED-WIDTH` (MED) — `width: 960px` على الحاوية الرئيسية = تجاوز أفقي مضمون على 320px.
- `VW-OVERFLOW` (MED) — `width: 100vw` على الhero: تمرير أفقي مع أول شريط تمرير عمودي.
- `NO-FLUID-OR-MQ` (MED) — CSS بلا `clamp()/min()/max()` ولا `@media`: تصميم ثابت.

القاعدة: **الفاحص أولًا** — الأرقام من السكربت لا من العين، تمامًا كما في `web-vitals`.

## الخطوة 2 — الإقلاع والسقف (§2 + §9)

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

```css
html  { font-size: clamp(1rem, 0.92rem + 0.3vw, 1.125rem); }  /* لا px على الجذر أبدًا */
.container { width: min(100% - 2rem, 72rem); margin-inline: auto; }  /* سقف بلا استعلام */
```

حظر صريح: `user-scalable=no` و`maximum-scale` دون 2 — فشل WCAG 1.4.4 (a11y يسود).

## الخطوة 3 — تايبوغرافي وتباعد سيّال (§3)

```css
h1 { font-size: clamp(2rem, 1.5rem + 2.5vw, 3.5rem); }
p  { font-size: clamp(1rem, 0.95rem + 0.2vw, 1.125rem); }
:root { --space: clamp(1rem, 0.8rem + 0.5vw, 1.5rem); }  /* يغذّي الرموز في tokens */
```

## الخطوة 4 — الشبكات واستعلامات الحاويات (§5 + §6)

```css
.cards { display: grid; gap: var(--space);
         grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr)); }
.card-wrap { container-type: inline-size; }
@container (min-width: 28rem) { .card { display: grid; grid-template-columns: 8rem 1fr; } }
```

النقاط التوقّف المتبقية للبنية فقط (تنقّل، أعمدة الصفحة) بوحدات `em/rem`.

## الخطوة 5 — الوسائط (§7، بإشراف web-vitals على التكلفة)

```html
<img src="hero-800.avif"
     srcset="hero-400.avif 400w, hero-800.avif 800w, hero-1600.avif 1600w"
     sizes="(max-width: 48em) 100vw, 60vw"
     width="1600" height="900" fetchpriority="high" alt="…">
```

`aspect-ratio` محجوز قبل التحميل (تكميل web-vitals §3) — الشكل هنا، التكلفة هناك.

## الخطوة 6 — بوابة التسليم

1. `responsive.mjs` على كل الصفحات → **صفر HIGH** (بوابة فاشلة = لا دمج).
2. `a11y`: zoom 200% عند 1280px → لا تمرير ثنائي الاتجاه (WCAG 1.4.4).
3. `web-vitals.mjs` → الأبعاد محجوزة ولا lazy على الhero (لا تراجع بعد الترقيع).
4. **RTL على كل نافذة**: `dir="rtl"` ثم عينات 320/768/1024/1440 — خصائص منطقية فقط.
5. `verify`: لقطات عند 320/768/1024/1440px بالاتجاهين + فحص `scrollWidth ≤ innerWidth` في الconsole.

**النتيجة:** صفحة تعمل من 320px حتى 4K بصفر استعلامات تقريبًا، بلا تجاوز أفقي، مع نقاط توقّف للبنية فقط — وقابل للتصدير كرموز DTCG عبر `tokens` (`--space-*`، `--step-*`).
