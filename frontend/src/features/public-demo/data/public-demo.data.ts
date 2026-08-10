import type { AlphabetLetter, LearningLevel, QuizQuestion } from '../types/public-demo.types';

export const learningLevels: readonly LearningLevel[] = [
  { level: 'A1', label: 'Boshlang‘ich', description: 'Asosiy so‘zlar va kundalik iboralar' },
  { level: 'A2', label: 'Elementar', description: 'Tanish mavzularda ishonchli muloqot' },
  { level: 'B1', label: 'O‘rta', description: 'Mustaqil tushunish va fikr bildirish' },
  { level: 'B2', label: 'O‘rtadan yuqori', description: 'Murakkab mavzularda ravonlik' },
  { level: 'C1', label: 'Ilg‘or', description: 'Nozik ma’no va uslubni anglash' },
  { level: 'C2', label: 'Mukammal', description: 'Yuqori darajadagi erkin qo‘llash' },
];

export const courseBenefits = [
  {
    icon: '01',
    title: 'Video darslar',
    description: 'Tushunarli, qisqa va mavzuga yo‘naltirilgan videolar.',
  },
  {
    icon: '02',
    title: 'Interaktiv mashqlar',
    description: 'Bilimni darhol qo‘llash va xatodan o‘rganish.',
  },
  { icon: '03', title: 'Lug‘at', description: 'Muhim so‘zlarni kontekstda ko‘rish va takrorlash.' },
  {
    icon: '04',
    title: 'Tinglab tushunish',
    description: 'Tabiiy turkcha nutqqa quloqni moslashtirish.',
  },
  {
    icon: '05',
    title: 'Testlar',
    description: 'Har bir bosqichda o‘zlashtirishni aniq tekshirish.',
  },
  {
    icon: '06',
    title: 'Progress kuzatuvi',
    description: 'Qayerda ekaningiz va keyingi qadamni bilish.',
  },
  {
    icon: '07',
    title: 'O‘qituvchi yordami',
    description: 'Savollar uchun insoniy yo‘nalish va maslahat.',
  },
  {
    icon: '08',
    title: 'Sertifikat',
    description: 'Kurs yakunidagi natijani tasdiqlash imkoniyati.',
  },
] as const;

export const learningSteps = [
  { number: '01', title: 'Darsni ko‘ring', description: 'Mavzuni sodda va aniq tushunib oling.' },
  { number: '02', title: 'Mashqlarni bajaring', description: 'Yangi bilimni darhol qo‘llang.' },
  {
    number: '03',
    title: 'Yakuniy testni ishlang',
    description: 'O‘zlashtirish darajangizni tekshiring.',
  },
  {
    number: '04',
    title: 'Natijangizni ko‘ring',
    description: 'Kuchli va takrorlash kerak bo‘lgan joylarni biling.',
  },
  {
    number: '05',
    title: 'Kursni davom ettiring',
    description: 'Tizimga kirib keyingi darslarni oching.',
  },
] as const;

export const faqs = [
  {
    question: 'Bepul darsni boshlash uchun ro‘yxatdan o‘tish kerakmi?',
    answer:
      'Yo‘q. Türk Alfabesi darsi va undagi mashqlarni tizimga kirmasdan sinab ko‘rishingiz mumkin.',
  },
  {
    question: 'Natijam saqlanadimi?',
    answer:
      'Bu MVP demo mashqlarida natija faqat brauzer oynasida saqlanadi. Kurs progressi esa autentifikatsiyalangan tajribada yuritiladi.',
  },
  {
    question: 'Keyingi kurslarga qanday qo‘shilaman?',
    answer:
      'Tizimga kiring va o‘qituvchi yoki administrator bilan bog‘laning. Ular sizga mos kursni tanlashda yordam beradi.',
  },
] as const;

export const alphabetLetters: readonly AlphabetLetter[] = [
  { uppercase: 'A', lowercase: 'a' },
  { uppercase: 'B', lowercase: 'b' },
  { uppercase: 'C', lowercase: 'c' },
  { uppercase: 'Ç', lowercase: 'ç', special: true },
  { uppercase: 'D', lowercase: 'd' },
  { uppercase: 'E', lowercase: 'e' },
  { uppercase: 'F', lowercase: 'f' },
  { uppercase: 'G', lowercase: 'g' },
  { uppercase: 'Ğ', lowercase: 'ğ', special: true },
  { uppercase: 'H', lowercase: 'h' },
  { uppercase: 'I', lowercase: 'ı', special: true },
  { uppercase: 'İ', lowercase: 'i', special: true },
  { uppercase: 'J', lowercase: 'j' },
  { uppercase: 'K', lowercase: 'k' },
  { uppercase: 'L', lowercase: 'l' },
  { uppercase: 'M', lowercase: 'm' },
  { uppercase: 'N', lowercase: 'n' },
  { uppercase: 'O', lowercase: 'o' },
  { uppercase: 'Ö', lowercase: 'ö', special: true },
  { uppercase: 'P', lowercase: 'p' },
  { uppercase: 'R', lowercase: 'r' },
  { uppercase: 'S', lowercase: 's' },
  { uppercase: 'Ş', lowercase: 'ş', special: true },
  { uppercase: 'T', lowercase: 't' },
  { uppercase: 'U', lowercase: 'u' },
  { uppercase: 'Ü', lowercase: 'ü', special: true },
  { uppercase: 'V', lowercase: 'v' },
  { uppercase: 'Y', lowercase: 'y' },
  { uppercase: 'Z', lowercase: 'z' },
];

export const specialLetters = alphabetLetters.filter(({ special }) => special);

export const practiceQuestions: readonly QuizQuestion[] = [
  {
    id: 'special-letter',
    kind: 'letter-choice',
    prompt: 'Turk alifbosidagi maxsus harfni tanlang.',
    options: ['Ç', 'Ş', 'Q', 'W'],
    answer: 'Ş',
    explanation: 'Ş — turk alifbosidagi alohida harf. Q va W turk alifbosiga kirmaydi.',
  },
  {
    id: 'i-distinction',
    kind: 'distinction',
    prompt: '“kız” so‘zidagi birinchi unli qaysi belgi bilan yoziladi?',
    options: ['I', 'İ', 'ı', 'i'],
    answer: 'ı',
    explanation: 'kız so‘zida nuqtasiz kichik ı ishlatiladi: k-ı-z.',
  },
  {
    id: 'special-pair',
    kind: 'special-choice',
    prompt: 'Qaysi juftlik turk alifbosidagi maxsus harfni ko‘rsatadi?',
    options: ['Ç / C', 'Ş / S', 'Ö / O', 'Ü / U'],
    answer: 'Ö / O',
    explanation: 'Ö va O alohida harflar. Ö nuqtali shakli bilan ajraladi.',
  },
  {
    id: 'missing-turkiye',
    kind: 'missing-letter',
    prompt: 'T_rkiye so‘zidagi bo‘sh joyga mos harfni tanlang.',
    options: ['u', 'ü', 'ı', 'i'],
    answer: 'ü',
    explanation: 'To‘g‘ri yozilishi Türkiye: T-ü-r-k-i-y-e.',
  },
  {
    id: 'matching',
    kind: 'matching',
    prompt: 'Katta Ğ harfining kichik shaklini toping.',
    options: ['g', 'ğ', 'q', 'Ğ'],
    answer: 'ğ',
    explanation: 'Ğ harfining kichik shakli ğ bo‘ladi.',
  },
  {
    id: 'word-recognition',
    kind: 'word-recognition',
    prompt: 'To‘g‘ri yozilgan turkcha so‘zni tanlang.',
    options: ['Türkiye', 'Turkıye', 'Turkiye', 'Türkıye'],
    answer: 'Türkiye',
    explanation: 'Türkiye so‘zida ü va nuqtali i — i ishlatiladi.',
  },
  {
    id: 'concept',
    kind: 'concept',
    prompt: 'Turk alifbosida odatda qaysi harflar ishlatilmaydi?',
    options: ['Q, W, X', 'Ç, Ş, Ğ', 'Ö, Ü, İ', 'A, E, I'],
    answer: 'Q, W, X',
    explanation: 'Turk alifbosi 29 harfdan iborat va Q, W, X harflarini odatda ishlatmaydi.',
  },
];

export const quickRoundQuestions: readonly QuizQuestion[] = [
  {
    id: 'quick-cay',
    kind: 'missing-letter',
    prompt: '_ay so‘zini to‘ldiring.',
    options: ['Ç', 'C', 'Ş', 'S'],
    answer: 'ç',
    explanation: 'To‘g‘ri so‘z çay: choy.',
  },
  {
    id: 'quick-seker',
    kind: 'missing-letter',
    prompt: '_eker so‘zini to‘ldiring.',
    options: ['Ş', 'S', 'Ç', 'C'],
    answer: 'ş',
    explanation: 'To‘g‘ri so‘z şeker: shakar.',
  },
  {
    id: 'quick-dag',
    kind: 'missing-letter',
    prompt: 'da_ so‘zini to‘ldiring.',
    options: ['g', 'ğ', 'q', 'Ğ'],
    answer: 'ğ',
    explanation: 'To‘g‘ri so‘z dağ: tog‘.',
  },
];

export const finalQuestions: readonly QuizQuestion[] = [
  {
    id: 'final-count',
    kind: 'concept',
    prompt: 'Turk alifbosida nechta harf bor?',
    options: ['26', '28', '29', '32'],
    answer: '29',
    explanation: 'Turk alifbosi 29 harfdan iborat.',
  },
  {
    id: 'final-cedilla',
    kind: 'special-choice',
    prompt: '“çay” so‘zining boshida qaysi harf bor?',
    options: ['c', 'ç', 'ş', 'ch'],
    answer: 'ç',
    explanation: 'ç harfi ch tovushiga yaqin talaffuz qilinadi.',
  },
  {
    id: 'final-capital',
    kind: 'matching',
    prompt: 'Katta İ harfining kichik shakli qaysi?',
    options: ['i', 'ı', 'İ', 'I'],
    answer: 'i',
    explanation: 'Nuqtali katta İ nuqtali kichik i bilan juft bo‘ladi.',
  },
  {
    id: 'final-missing',
    kind: 'missing-letter',
    prompt: 'k_z so‘zidagi bo‘sh joyni to‘ldiring.',
    options: ['i', 'ı', 'İ', 'I'],
    answer: 'ı',
    explanation: 'To‘g‘ri yozilishi kız.',
  },
  {
    id: 'final-gel',
    kind: 'word-recognition',
    prompt: 'Qaysi variant “kel” so‘zining turkcha yozilishiga mos?',
    options: ['gel', 'ğel', 'jel', 'gäl'],
    answer: 'gel',
    explanation: 'gel so‘zi g-e-l harflari bilan yoziladi.',
  },
  {
    id: 'final-oem',
    kind: 'distinction',
    prompt: '“öğretmen” so‘zida qaysi maxsus harflar bor?',
    options: ['ö va ğ', 'o va g', 'ü va ş', 'ç va ı'],
    answer: 'ö va ğ',
    explanation: 'O‘qituvchi ma’nosidagi öğretmen so‘zida ö va ğ bor.',
  },
  {
    id: 'final-pronunciation',
    kind: 'concept',
    prompt: 'Nuqtasiz kichik ı haqida qaysi fikr to‘g‘ri?',
    options: [
      'U nuqtali i bilan bir xil yoziladi',
      'U alohida turk harfi',
      'U faqat bosh harf bo‘ladi',
      'U Q harfining shakli',
    ],
    answer: 'U alohida turk harfi',
    explanation: 'ı — nuqtasiz kichik i bo‘lib, turk alifbosidagi alohida harfdir.',
  },
  {
    id: 'final-uppercase',
    kind: 'matching',
    prompt: 'Katta Ş harfining kichik shaklini tanlang.',
    options: ['s', 'ş', 'S', 'ç'],
    answer: 'ş',
    explanation: 'Ş va ş bir juft: katta va kichik shakl.',
  },
  {
    id: 'final-country',
    kind: 'word-recognition',
    prompt: '“Turkey” so‘zining turkcha yozilishini toping.',
    options: ['Türkiye', 'Turkiye', 'Türkıye', 'Tűrkiye'],
    answer: 'Türkiye',
    explanation: 'Turkcha yozilishida ü va nuqtali i ishlatiladi: Türkiye.',
  },
  {
    id: 'final-no-qwx',
    kind: 'concept',
    prompt: 'Qaysi qatorda turk alifbosida odatda bo‘lmaydigan harflar bor?',
    options: ['Q, W, X', 'Ç, Ğ, Ş', 'Ö, Ü, İ', 'A, B, C'],
    answer: 'Q, W, X',
    explanation: 'Q, W va X turk alifbosining odatiy 29 harfi qatoriga kirmaydi.',
  },
];
