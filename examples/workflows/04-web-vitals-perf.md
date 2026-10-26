# المشيّة 4 — صفحة هبوط تفشل في Core Web Vitals → تجتازها (v2.2.0)

**المهمة:** «صفحة الهبوط بطيئة، Lighthouse يقول LCP فاشل وCLS فاشل، والعميل يريد درجة أداء خضراء دون التخلي عن التصميم الحالي.»

**الوحدات المستخدمة:** `web-vitals` → `polish` (عند لزوم تعديل بصري) → `verify`

**التحدي المركزي:** الأداء بنيويّ قبل أن يكون بصريًا — قاتلات LCP/CLS/INP مخبأة في الترميز نفسه، ولا يُخمَّن رقم أبدًا: يُقاس. قاعدة الأداة: ميزانية الخيط الرئيسي في `web-vitals` تسود على أي حركة أو تأثير جمالي.

---

## الخطوة 1 — web-vitals: التشخيص الثابت قبل فتح المتصفح

اقرأ `skills/web-vitals/MANUAL.md` ثم شغّل المحلل على كل ملفات الصفحة:

```bash
node skills/web-vitals/scripts/webvitals.mjs ./dist/          # تقرير نصي لكل HTML
node skills/web-vitals/scripts/webvitals.mjs ./dist/ --json   # للدمج في CI
```

المخرجات النموذجية لصفحة تفشل — وكل بند مربوط بمقياس وإصلاح محدد:

```text
  ✗ [LCP] the first <img> uses loading="lazy"          ← الـhero يُكتشف متأخرًا
  ✗ [CLS] 3 <img> without width+height attributes      ← انزياح مضمون عند التحميل
  ✗ [LCP] 2 render-blocking <script> in <head>         ← تحليل HTML متوقف
  ! [CLS] 1 @font-face missing font-display            ← نص غير مرئي ثم قفزة
  · [LCP] first <img> lacks fetchpriority="high"       ← يخسر سباق النطاق الترددي
```

## الخطوة 2 — تطبيق خط لعب LCP

1. صورة الـhero: أزل `loading="lazy"` نهائيًا (البديل الصامت — لا شيء)، أضف
   `fetchpriority="high"`، وحوّلها إلى AVIF/WebP بحجم ≤ 100KB مضغوط مع
   `srcset`/`sizes` صحيحين. إن كانت خلفية CSS أو تُبنى من JS → `<link
   rel="preload" as="image" fetchpriority="high">` في الـhead.
2. كل سكربت خارجي في الـhead → `defer` (أو `type="module"`)؛ وحظر
   `document.write` نهائيًا.
3. الخطوط: `font-display: swap` + خط احتياطي مطابق المقاييس (`size-adjust`)،
   و`preconnect` لأصل الخطوط قبل ورقة الأنماط.

## الخطوة 3 — إصلاح CLS: احجز الصندوق قبل وصول المحتوى

- كل `<img>` و`<iframe>` بـ`width`/`height` صريحين (أو `aspect-ratio` في CSS).
- المساحات الديناميكية (إعلانات، تضمينات، لافتة موافقة) بمقاعد محجوزة
  `min-height` — تُغطّي ولا تدفع المحتوى القائم.
- skeletons تحاكي الهندسة النهائية بدل الـspinner المركزي.
- تحريك `transform`/`opacity` فقط — أي تحريك لـ`top`/`margin`/`height` ينزيح
  ويقفز.

## الخطوة 4 — INP: حراس الخيط الرئيسي

أي معالج نقر أثقل من 50ms يُجزّأ بـ`await scheduler.yield()` (أو
`setTimeout(0)`)، وقراءات/كتابات DOM تُجمَّع دفعة واحدة (لا `getBoundingClientRect`
بين كتابتين)، والمكتبات الثقيلة (chat، فيديو) خلف facades تنقر للتحميل،
وتُقسّم الحزم حسب المسار (route-level code splitting).

## الخطوة 5 — القياس: رقم أم لم يحدث شيء

حدد الميزانية في PR (جدول §8 من الدليل: JS حرج ≤ 170KB مضغوط، صورة LCP ≤
100KB، صفر مهام طويلة > 100ms عند الإقلاع…)، ثم قِس:

```html
<script type="module">
  import { onLCP, onINP, onCLS } from 'web-vitals';
  const log = (m) => navigator.sendBeacon('/vitals', JSON.stringify(m));
  onLCP(log); onINP(log); onCLS(log);
</script>
```

Lighthouse يفسّر *لماذا*، وبيانات الحقل (CrUX/RUM عند p75) تحسم *هل تجتاز*.
اختبر بشبكة 4G مقيّدة وCPU أبطأ 4×، لا بجهاز التطوير. أخيرًا شغّل `verify`
(playwright-cli): لقطات قبل/بعد على عرضَي دسكتوب وموبايل مع جمع مؤشرات
`web-vitals` في الجلسة نفسها، وسلّم نتائج التدقيق من 12 نقطة (§9) مع صفحة
التسليم — بجانب تدقيق `a11y` الشقيق.
