# المشيّة 3 — موقع تسويقي بحركة سينمائية متوافقة مع الإتاحة

**المهمة:** «أريد موقع منتج سينمائي: مشهد بطل يتحرك مع التمرير ويثبت، عدّادات إحصائيات، نص يتكشف حرفًا حرفًا — لكن دون أن يسبب دوارًا لأحد، ومع مودال تسجيل سلس.»

**الوحدات المستخدمة:** `taste` → `motion/gsap` + `motion/transitions` → `a11y` → `polish` → `verify`

**التحدي المركزي:** أقصى حركة + صفر ضرر دهليزي. قاعدة الأداة: قواعد `a11y` تسود على أي تفضيل جمالي عند التعارض.

---

## الخطوة 1 — taste: الاتجاه قبل أي timeline

اقرأ `skills/taste/MANUAL.md`. الموقع السينمائي فخّ أخطرها slop: تدرجات متوهجة + بطاقات زجاجية = صفحة AI نمطية. اترك draw.mjs يعرض الاتجاهات واختر فكرة من المنتج نفسه (مثال: منتج مادي → تصوير ماكرو + تايبوغرافي هندسي مُحكم)، وحدد نظام الحركة داخل هذا الاتجاه: حركة واحدة مهيمنة (scroll scene)، والباقي micro.

## الخطوة 2 — motion/gsap: المشهد المثبت (مع حارسه)

اقرأ `skills/gsap/gsap-scrolltrigger/MANUAL.md` ثم `gsap-react/MANUAL.md` إن كان المشروع React (نمط `useGSAP` + تنظيف). عناصر المشهد:

```js
// gsap.matchMedia هو الحارس — الحركة الكبيرة للمتسامحين فقط
const mm = gsap.matchMedia();

mm.add("(prefers-reduced-motion: no-preference)", () => {
  const tl = gsap.timeline({
    scrollTrigger: { trigger: "#hero", start: "top top", end: "+=1200", pin: true, scrub: 0.6 }
  });
  tl.from(".hero-word", { yPercent: 120, stagger: 0.08 })
    .to(".hero-product", { scale: 1.15, rotate: -4 }, "<0.2");
});

// للذين يفضلون تقليل الحركة: تركيبة ثابتة أنيقة بلا pin ولا scrub
mm.add("(prefers-reduced-motion: reduce)", () => {
  gsap.set(".hero-word", { opacity: 1, yPercent: 0 });
});
```

عدّادات الإحصائيات: `gsap.to(obj, { val: target, snap: { val: 1 }, onUpdate: render })` — لكنها داخل `matchMedia` أيضًا، وللمقلّلين أظهر الرقم النهائي فورًا. مكوّن نص جاهز من `components` (اسم موجود في `catalog.json` فقط) بديل مقبول عن SplitText اليدوي.

## الخطوة 3 — motion/transitions: المودال والحالات الصغيرة

اقرأ `skills/transitions/transitions-dev/MANUAL.md`. المودال والحالات من عالم CSS الرخيص — **لا GSAP هنا** (قاعدة فصل الأدوات): مودال تسجيل من المراجع الجاهزة بحركة `transform + opacity` فقط، و toast نجاح، و skeleton أثناء إرسال النموذج. كل مقطع يحمل حارسه `@media (prefers-reduced-motion: reduce)` كما في الأصل.

## الخطوة 4 — a11y: سونار الحركة قبل الإبحار

اقرأ `skills/a11y/MANUAL.md` (§7 تحديدًا):

- كل مشهد كبير مرّ عبر `matchMedia` — تحقق بأن **لا شيء** يعمل تحت `reduce` عدا التلاشي.
- بديل ذو معنى للمتسامحين: نفس المحتوى، بلا عمق زائف (كلمة قصاصة تظهر كاملة، عدّاد يظهر نهائيًا).
- المودال: `role="dialog"` + `aria-modal` + إدخال تركيز + مصيدة Tab + خروج Esc + إعادة التركيز للزر المستدعي.
- السكرول المساعد بلا مفاجآت: أي عنصر ثابت الزوم أو دوران >25° ممنوع خارج الحارس.
- التباين فوق الفيديو/الصورة: طبقة تعتيم تجعل النص 4.5:1 — افحصها بسكربت التباين على القيم الفعلية.

## الخطوة 5 — polish ثم verify

```text
/impeccable polish src/
/impeccable audit src/
```

ثم اقرأ `skills/playwright-cli/MANUAL.md` وسجّل الفارق بين الوضعين:

```bash
playwright-cli open http://localhost:3000
playwright-cli screenshot --viewport 1440x900 motion-on.png
# أعد التشغيل مع تفضيل reduce (emulation) وصوّر مجددًا — يجب أن تظهر التركيبة الثابتة
playwright-cli screenshot --viewport 1440x900 motion-reduced.png
playwright-cli video  # سجّل تدفق فتح المودال والإرسال والنجاح
```

قارن اللقطتين: نفس المحتوى الكامل في الحالتين، فقط أسلوب الوصول يختلف.

**النتيجة النهائية:** موقع سينمائي حقيقي (pin + scrub + stagger)، محمي دهليزيًا بالكامل، موداله متقن للكيبورد وقارئ الشاشة، ومُدقق بعين impeccable قبل الإبحار.
