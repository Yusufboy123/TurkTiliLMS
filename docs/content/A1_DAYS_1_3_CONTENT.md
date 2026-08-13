# A1 darslar: 1–3-kunlar

Kurs bo‘limi kelajakdagi kengaytirish uchun `A1 — 1–12-kunlar` deb nomlangan;
ushbu batchda faqat 1–3-kunlar to‘ldiriladi.

Bu batch `Turk tili A1` kursining faqat dastlabki uchta darsini yaratadi:

1. `Türk Alfabesi ve Sesler`
2. `Tanışma ve Kendini Tanıtma`
3. `Çoğul + İşaret + Soru`

Har bir dars Uzbek Latin izohi, turkcha misollar, 15 ta lug‘at yozuvi va aralash
quiz savollaridan iborat. 1-kun shuningdek 30 ta interaktiv practice item-ni
lesson kontent blokining xavfsiz pedagogik metadata qismida beradi; practice
javoblari alohida authenticated endpoint orqali tekshiriladi va javob kaliti
GET payloadiga kiritilmaydi. Savollar faqat mavjud
`MULTIPLE_CHOICE`, `TRUE_FALSE` va `MISSING_WORD` turlaridan foydalanadi.

## Ishga tushirish

Avval odatdagi identity seed orqali faol Teacher mavjud bo‘lishi kerak. Keyin
content seed alohida ishga tushiriladi:

```text
A1_CONTENT_TEACHER_EMAIL=teacher@example.com npm run prisma:seed:a1 --workspace backend
```

`A1_CONTENT_TEACHER_EMAIL` berilmasa, seed eng avval yaratilgan faol Teacher-ni
tanlaydi. Teacher topilmasa seed xatolik bilan to‘xtaydi; u soxta production
foydalanuvchi yaratmaydi.

Seed qayta ishlatiladigan (idempotent): kurs, bo‘lim, dars, matn bloklari,
lug‘atlar va savollar tabiiy kalitlari orqali yangilanadi. Mavjud video blokiga
biriktirilgan `mediaFileId` qayta ishga tushirganda o‘zgartirilmaydi. Quiz
attemptlari, natijalar, progress va enrollmentlar o‘chirilmaydi.

Media-backed `VIDEO` blok MediaFile-siz yaratilishi mumkin emasligi sababli seed
soxta URL yoki fayl yaratmaydi. Teacher keyin mavjud upload workflow orqali real
video blokini biriktiradi; eski yashirin markerlar qayta seed paytida soft-delete
qilinadi.

Uchala dars `PUBLISHED` va `masteryEnabled=true` bilan yaratiladi. 1-kun topic
mastery o‘tish chegarasi 75%; A1 darslarining threshold qiymati 75% bilan bir xil.
1-kun final testida bir server UTC kunida uchta muvaffaqiyatsiz
urinishdan keyin yangi final urinish keyingi kungacha yopiladi; o‘qish va
practice davom etadi. Bu mavjud Lesson Mastery Gate va retry oqimini saqlaydi.

## Vocabulary source

Authoritative source found at:
`C:\Users\YusufboY\Desktop\Lugatlar_TR_UZ_A1_A2_togrilangan.html`

It is an HTML vocabulary trainer containing an embedded `allWords` JSON array:

- total entries: 1,454
- A1: 742
- A2: 712
- duplicate Turkish/Uzbek pairs: A1 5, A2 18
- missing Turkish/Uzbek values: 0

The first batch now uses source spellings/translations for its lesson words.
Day 1 focuses on letters and recognition; Day 2 on greetings, people and
professions; Day 3 on everyday objects used with plural and demonstratives.
The remaining source vocabulary is intentionally unassigned for later A1/A2
lessons. Older temporary grammar-only entries are soft-deleted during the
idempotent seed reconciliation; historical rows and student references remain.
