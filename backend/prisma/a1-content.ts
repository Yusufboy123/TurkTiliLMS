export type A1QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MISSING_WORD';

export interface A1ContentBlockDefinition {
  key: string;
  title: string;
  blockType: 'TEXT' | 'VIDEO';
  position: number;
  textContent?: string;
  isVisible?: boolean;
  isRequired?: boolean;
  practiceItems?: A1PracticeItemDefinition[];
}

export type A1PracticeItemType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MISSING_WORD' | 'CLASSIFY';

export interface A1PracticeItemDefinition {
  id: string;
  type: A1PracticeItemType;
  prompt: string;
  options?: string[];
  answer: string;
  explanation: string;
  stage: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface A1VocabularyDefinition {
  turkishWord: string;
  uzbekMeaning: string;
  exampleSentence?: string;
  position: number;
}

export interface A1QuestionOptionDefinition {
  text: string;
  isCorrect: boolean;
  position: number;
}

export interface A1QuestionDefinition {
  type: A1QuestionType;
  prompt: string;
  explanation: string;
  points: number;
  position: number;
  options: A1QuestionOptionDefinition[];
}

export interface A1LessonDefinition {
  day: number;
  slug: string;
  title: string;
  summary: string;
  durationMinutes: number;
  contentBlocks: A1ContentBlockDefinition[];
  vocabulary: A1VocabularyDefinition[];
  questions: A1QuestionDefinition[];
  masteryPassingPercentage?: number;
}

const mc = (prompt: string, explanation: string, position: number, options: string[], correct: number): A1QuestionDefinition => ({
  type: 'MULTIPLE_CHOICE', prompt, explanation, points: 1, position,
  options: options.map((text, index) => ({ text, isCorrect: index === correct, position: index + 1 })),
});

const tf = (prompt: string, explanation: string, position: number, correct: boolean): A1QuestionDefinition => ({
  type: 'TRUE_FALSE', prompt, explanation, points: 1, position,
  options: [{ text: 'To‘g‘ri', isCorrect: correct, position: 1 }, { text: 'Noto‘g‘ri', isCorrect: !correct, position: 2 }],
});

const missing = (prompt: string, explanation: string, position: number, correct: string, distractors: string[]): A1QuestionDefinition => {
  // Vary correct answer position across options so missing-word questions don't always put correct answer in index 0
  const targetPos = (position % (distractors.length + 1));
  const opts = [...distractors];
  opts.splice(targetPos, 0, correct);

  return {
    type: 'MISSING_WORD',
    prompt,
    explanation,
    points: 1,
    position,
    options: opts.map((text, index) => ({ text, isCorrect: text === correct, position: index + 1 })),
  };
};

const block = (key: string, title: string, position: number, textContent: string, practiceItems?: A1PracticeItemDefinition[]): A1ContentBlockDefinition => ({ key, title, position, blockType: 'TEXT', textContent, ...(practiceItems ? { practiceItems } : {}) });

const day1PracticeItemsSource: A1PracticeItemDefinition[] = [
  // 1-Bosqich: Tasniflash (balanced options order)
  { id: 'd1-p01', type: 'CLASSIFY', prompt: '“a” harfini tasniflang.', options: ['Ingichka unli', 'Qalin unli'], answer: 'Qalin unli', explanation: 'a — qalin (kalın) unli tovushdir.', stage: 1 },
  { id: 'd1-p02', type: 'CLASSIFY', prompt: '“e” harfini tasniflang.', options: ['Ingichka unli', 'Qalin unli'], answer: 'Ingichka unli', explanation: 'e — ingichka (ince) unli tovushdir.', stage: 1 },
  { id: 'd1-p03', type: 'CLASSIFY', prompt: '“ı” harfini tasniflang.', options: ['Ingichka unli', 'Qalin unli'], answer: 'Qalin unli', explanation: 'ı — nuqtasiz qalin unli tovushdir.', stage: 1 },
  { id: 'd1-p04', type: 'CLASSIFY', prompt: '“ö” harfini tasniflang.', options: ['Qalin unli', 'Ingichka unli'], answer: 'Ingichka unli', explanation: 'ö — lablangan ingichka unli tovushdir.', stage: 1 },
  { id: 'd1-p05', type: 'TRUE_FALSE', prompt: '“b” harfi unlimi yoki undoshmi? (Tanlov: Undosh)', options: ['To‘g‘ri', 'Noto‘g‘ri'], answer: 'To‘g‘ri', explanation: 'b — undosh (ünsüz) harfdir.', stage: 1 },

  // 2-Bosqich: Kichik harf shakli
  { id: 'd1-p06', type: 'MULTIPLE_CHOICE', prompt: '“I” (nuqtasiz bosh harf) harfining kichik shakli qaysi?', options: ['i', 'ı', 'İ'], answer: 'ı', explanation: 'Katta I ning kichik shakli nuqtasiz ı dir.', stage: 2 },
  { id: 'd1-p07', type: 'MULTIPLE_CHOICE', prompt: '“İ” (nuqtali bosh harf) harfining kichik shakli qaysi?', options: ['ı', 'i', 'I'], answer: 'i', explanation: 'Katta İ ning kichik shakli nuqtali i dir.', stage: 2 },
  { id: 'd1-p08', type: 'MULTIPLE_CHOICE', prompt: '“Ş” harfining kichik shakli qaysi?', options: ['s', 'ş', 'ç'], answer: 'ş', explanation: 'Katta Ş ning kichik shakli ş dir.', stage: 2 },
  { id: 'd1-p09', type: 'MULTIPLE_CHOICE', prompt: '“Ç” harfining kichik shakli qaysi?', options: ['c', 'ş', 'ç'], answer: 'ç', explanation: 'Katta Ç ning kichik shakli ç dir.', stage: 2 },
  { id: 'd1-p10', type: 'MULTIPLE_CHOICE', prompt: '“Ğ” harfining kichik shakli qaysi?', options: ['g', 'ğ', 'h'], answer: 'ğ', explanation: 'Katta Ğ ning kichik shakli ğ dir.', stage: 2 },

  // 3-Bosqich: So‘zdagi maxsus harflar
  { id: 'd1-p11', type: 'MULTIPLE_CHOICE', prompt: '“öğrenci” so‘zidagi turkchaga xos harflarni ko‘rsating.', options: ['o, g', 'ö, ğ', 'ü, ı'], answer: 'ö, ğ', explanation: 'öğrenci so‘zida ö va ğ maxsus harflari bor.', stage: 3 },
  { id: 'd1-p12', type: 'MULTIPLE_CHOICE', prompt: '“ışık” so‘zidagi turkchaga xos harfni ko‘rsating.', options: ['i', 'ö', 'ı'], answer: 'ı', explanation: 'ışık so‘zida nuqtasiz ı harfi 2 marta qatnashgan.', stage: 3 },
  { id: 'd1-p13', type: 'MULTIPLE_CHOICE', prompt: '“şehir” so‘zidagi turkchaga xos harfni ko‘rsating.', options: ['s', 'ç', 'ş'], answer: 'ş', explanation: 'şehir so‘zida ş (sh) harfi bor.', stage: 3 },
  { id: 'd1-p14', type: 'MULTIPLE_CHOICE', prompt: '“küçük” so‘zidagi turkchaga xos harflarni ko‘rsating.', options: ['u, c', 'ü, ç', 'ö, ş'], answer: 'ü, ç', explanation: 'küçük so‘zida ü va ç harflari ishlatilgan.', stage: 3 },
  { id: 'd1-p15', type: 'MULTIPLE_CHOICE', prompt: '“ağaç” so‘zidagi turkchaga xos harflarni ko‘rsating.', options: ['g, c', 'ş, i', 'ğ, ç'], answer: 'ğ, ç', explanation: 'ağaç so‘zida ğ va ç harflari ishlatilgan.', stage: 3 },

  // 4-Bosqich: Oxirgi unlini tekshirish
  { id: 'd1-p16', type: 'CLASSIFY', prompt: '“kitap” so‘zining oxirgi unlisi qalinmi yoki ingichkami?', options: ['Ingichka unli', 'Qalin unli'], answer: 'Qalin unli', explanation: 'kitap so‘zidagi oxirgi unli a — qalin unli.', stage: 4 },
  { id: 'd1-p17', type: 'CLASSIFY', prompt: '“şehir” so‘zining oxirgi unlisi qalinmi yoki ingichkami?', options: ['Qalin unli', 'Ingichka unli'], answer: 'Ingichka unli', explanation: 'şehir so‘zidagi oxirgi unli i — ingichka unli.', stage: 4 },
  { id: 'd1-p18', type: 'CLASSIFY', prompt: '“okul” so‘zining oxirgi unlisi qalinmi yoki ingichkami?', options: ['Ingichka unli', 'Qalin unli'], answer: 'Qalin unli', explanation: 'okul so‘zidagi oxirgi unli u — qalin unli.', stage: 4 },
  { id: 'd1-p19', type: 'CLASSIFY', prompt: '“göz” so‘zining oxirgi unlisi qalinmi yoki ingichkami?', options: ['Ingichka unli', 'Qalin unli'], answer: 'Ingichka unli', explanation: 'göz so‘zidagi oxirgi unli ö — ingichka unli.', stage: 4 },
  { id: 'd1-p20', type: 'CLASSIFY', prompt: '“kapı” so‘zining oxirgi unlisi qalinmi yoki ingichkami?', options: ['Ingichka unli', 'Qalin unli'], answer: 'Qalin unli', explanation: 'kapı so‘zidagi oxirgi unli ı — qalin unli.', stage: 4 },

  // 5-Bosqich: Talaffuz va izoh
  { id: 'd1-p21', type: 'MULTIPLE_CHOICE', prompt: '“cam” va “ceket” so‘zlaridagi c harfi qanday aytiladi?', options: ['ch tovushi', 'o‘zbekchadagi j ga yaqin', 's tovushi'], answer: 'o‘zbekchadagi j ga yaqin', explanation: 'c harfi o‘zbekcha “j” (jurnal, joy) tovushini beradi.', stage: 5 },
  { id: 'd1-p22', type: 'MULTIPLE_CHOICE', prompt: '“çay” va “çocuk” so‘zlaridagi ç harfi qanday aytiladi?', options: ['j tovushi', 'ch tovushi', 'sh tovushi'], answer: 'ch tovushi', explanation: 'ç harfi o‘zbekchadagi “ch” tovushiga to‘g‘ri keladi.', stage: 5 },
  { id: 'd1-p23', type: 'MULTIPLE_CHOICE', prompt: '“dağ” so‘zidagi ğ harfining talaffuzdagi roli nima?', options: ['Qattiq g‘ kabi aytiladi', 'Oldingi unlini cho‘zadi', 'Ovoz chiqarilmaydi'], answer: 'Oldingi unlini cho‘zadi', explanation: 'dağ so‘zida ğ alohida qattiq tovush emas, a ni cho‘zib aytiladi.', stage: 5 },
  { id: 'd1-p24', type: 'MULTIPLE_CHOICE', prompt: '“şeker” so‘zidagi ş harfi qanday aytiladi?', options: ['s tovushi', 'sh tovushi', 'ch tovushi'], answer: 'sh tovushi', explanation: 'ş harfi o‘zbekcha “sh” tovushini beradi.', stage: 5 },
  { id: 'd1-p25', type: 'MULTIPLE_CHOICE', prompt: '“kız” so‘zidagi ı harfi qanday harf?', options: ['nuqtali i', 'nuqtasiz i', 'u harfi'], answer: 'nuqtasiz i', explanation: 'ı — nuqtasiz qalin unli harfdir.', stage: 5 },

  // 6-Bosqich: Jarangsiz undoshlar
  { id: 'd1-p26', type: 'TRUE_FALSE', prompt: '“sınıf” so‘zi f,s,t,k,ç,ş,h,p (Fıstıkçı Şahap) jarangsiz undoshlaridan biri bilan tugaydimi?', options: ['To‘g‘ri', 'Noto‘g‘ri'], answer: 'To‘g‘ri', explanation: 'sınıf so‘zi f harfi bilan tugaydi, f — jarangsiz undosh.', stage: 6 },
  { id: 'd1-p27', type: 'TRUE_FALSE', prompt: '“park” so‘zi Fıstıkçı Şahap guruhidagi harf bilan tugaydimi?', options: ['To‘g‘ri', 'Noto‘g‘ri'], answer: 'To‘g‘ri', explanation: 'park k harfi bilan tugaydi (k — jarangsiz).', stage: 6 },
  { id: 'd1-p28', type: 'TRUE_FALSE', prompt: '“ev” so‘zi Fıstıkçı Şahap guruhidagi harf bilan tugaydimi?', options: ['To‘g‘ri', 'Noto‘g‘ri'], answer: 'Noto‘g‘ri', explanation: 'ev v harfi bilan tugaydi; v jarangsiz undoshlar guruhiga kirmaydi.', stage: 6 },
  { id: 'd1-p29', type: 'MISSING_WORD', prompt: 'Turk alifbosida yo‘q 3 ta chet til harflarini yozing: Q, ___, X.', answer: 'W', explanation: 'Standart turk alifbosida Q, W, X harflari yo‘q.', stage: 6 },
  { id: 'd1-p30', type: 'MISSING_WORD', prompt: '“İstanbul” so‘zining bosh harfi nuqtali ___ harfi bilan yoziladi.', answer: 'İ', explanation: 'Turk imlosida joy nomlarida bosh harf nuqtali İ bo‘ladi: İstanbul.', stage: 6 },
];

const day1PromptOverrides: Record<string, string> = {
  'd1-p01': 'Ko‘rsatma: Harfni qalin yoki ingichka unli sifatida tasniflang. Harf: “a”.',
  'd1-p02': 'Ko‘rsatma: Harfni qalin yoki ingichka unli sifatida tasniflang. Harf: “e”.',
  'd1-p03': 'Ko‘rsatma: Harfni qalin yoki ingichka unli sifatida tasniflang. Harf: “ı”.',
  'd1-p04': 'Ko‘rsatma: Harfni qalin yoki ingichka unli sifatida tasniflang. Harf: “ö”.',
  'd1-p05': 'Ko‘rsatma: “b” harfi unli yoki undosh ekanini aniqlang. To‘g‘ri variantni tanlang.',
  'd1-p06': 'Ko‘rsatma: Berilgan bosh harfning kichik shaklini tanlang. Bosh harf: “I” (nuqtasiz).',
  'd1-p07': 'Ko‘rsatma: Berilgan bosh harfning kichik shaklini tanlang. Bosh harf: “İ” (nuqtali).',
  'd1-p08': 'Ko‘rsatma: Berilgan bosh harfning kichik shaklini tanlang. Bosh harf: “Ş”.',
  'd1-p09': 'Ko‘rsatma: Berilgan bosh harfning kichik shaklini tanlang. Bosh harf: “Ç”.',
  'd1-p10': 'Ko‘rsatma: Berilgan bosh harfning kichik shaklini tanlang. Bosh harf: “Ğ”.',
  'd1-p11': 'Ko‘rsatma: So‘zda uchraydigan turkchaga xos harflarni tanlang. So‘z: “öğrenci”.',
  'd1-p12': 'Ko‘rsatma: So‘zda uchraydigan turkchaga xos harfni tanlang. So‘z: “ışık”.',
  'd1-p13': 'Ko‘rsatma: So‘zda uchraydigan turkchaga xos harfni tanlang. So‘z: “şehir”.',
  'd1-p14': 'Ko‘rsatma: So‘zda uchraydigan turkchaga xos harflarni tanlang. So‘z: “küçük”.',
  'd1-p15': 'Ko‘rsatma: So‘zda uchraydigan turkchaga xos harflarni tanlang. So‘z: “ağaç”.',
  'd1-p16': 'Ko‘rsatma: So‘zning oxirgi unlisini qalin yoki ingichka deb tasniflang. So‘z: “kitap”.',
  'd1-p17': 'Ko‘rsatma: So‘zning oxirgi unlisini qalin yoki ingichka deb tasniflang. So‘z: “şehir”.',
  'd1-p18': 'Ko‘rsatma: So‘zning oxirgi unlisini qalin yoki ingichka deb tasniflang. So‘z: “okul”.',
  'd1-p19': 'Ko‘rsatma: So‘zning oxirgi unlisini qalin yoki ingichka deb tasniflang. So‘z: “göz”.',
  'd1-p20': 'Ko‘rsatma: So‘zning oxirgi unlisini qalin yoki ingichka deb tasniflang. So‘z: “kapı”.',
  'd1-p21': 'Ko‘rsatma: Berilgan so‘zlardagi “c” harfining talaffuzini tanlang. So‘zlar: “cam” va “ceket”.',
  'd1-p22': 'Ko‘rsatma: Berilgan so‘zlardagi “ç” harfining talaffuzini tanlang. So‘zlar: “çay” va “çocuk”.',
  'd1-p23': 'Ko‘rsatma: “dağ” so‘zidagi “ğ” harfining talaffuzdagi rolini tanlang.',
  'd1-p24': 'Ko‘rsatma: “şeker” so‘zidagi “ş” harfining talaffuzini tanlang.',
  'd1-p25': 'Ko‘rsatma: “kız” so‘zidagi “ı” harfining qanday harf ekanini tanlang.',
  'd1-p26': 'Ko‘rsatma: “sınıf” so‘zi Fıstıkçı Şahap guruhidagi jarangsiz undosh bilan tugaydimi? To‘g‘ri yoki Noto‘g‘ri ni tanlang.',
  'd1-p27': 'Ko‘rsatma: “park” so‘zi Fıstıkçı Şahap guruhidagi jarangsiz undosh bilan tugaydimi? To‘g‘ri yoki Noto‘g‘ri ni tanlang.',
  'd1-p28': 'Ko‘rsatma: “ev” so‘zi Fıstıkçı Şahap guruhidagi jarangsiz undosh bilan tugaydimi? To‘g‘ri yoki Noto‘g‘ri ni tanlang.',
  'd1-p29': 'Ko‘rsatma: Bo‘sh joyga turk alifbosida mavjud bo‘lmagan harfni yozing. Q, ___, X.',
  'd1-p30': 'Ko‘rsatma: “İstanbul” so‘zining bosh harfini to‘ldiring: nuqtali ___ harfi.',
};

const day1PracticeItems: A1PracticeItemDefinition[] = day1PracticeItemsSource.map((item) => ({
  ...item,
  prompt: day1PromptOverrides[item.id] ?? item.prompt,
}));

const vocab = (entries: ReadonlyArray<readonly [string, string, string, number]>): A1VocabularyDefinition[] => entries.map(([turkishWord, uzbekMeaning, exampleSentence, position]) => ({ turkishWord, uzbekMeaning, exampleSentence, position }));

type A1PracticeStage = 1 | 2 | 3 | 4 | 5 | 6;

const workbookGroup = (
  prefix: string,
  _title: string,
  _instruction: string,
  stage: A1PracticeStage,
  entries: ReadonlyArray<readonly [string, string]>,
): A1PracticeItemDefinition[] => entries.map(([prompt, answer], index) => ({
  id: `${prefix}-g${_title.match(/^(\d+)-MASHQ/)?.[1] ?? stage}-p${String(index + 1).padStart(2, '0')}`,
  type: 'MISSING_WORD',
  // Workbook group labels and internal instructions are represented by the
  // separate stage indicator; keep only the student-facing task here.
  prompt,
  answer,
  explanation: 'Javob workbookdagi qoida va namuna bilan tekshiriladi. Ochiq topshiriqlarda avtomatik tekshiruv uchun javob namunasi berilgan.',
  stage,
}));

const day2PracticeItems: A1PracticeItemDefinition[] = [
  ...workbookGroup('d2', '1-MASHQ — 1-BOSQICH — JUDA OSON — 1-qism', 'Shart: bandlarni ketma-ket bajaring; javobni darslikdagi qoida bilan tekshiring.', 1, [
    ['Ko‘rsatma: salomlashish iborasini yozing. Vaziyat: Ertalab bir kishini ko‘rdingiz.', 'Günaydın!'], ['Ko‘rsatma: odatiy salomlashish iborasini yozing. Vaziyat: Kun davomida tanishingiz bilan uchrashdingiz.', 'Merhaba!'], ['Ko‘rsatma: norasmiy salomlashish iborasini yozing. Vaziyat: Yaqin do‘stingiz bilan uchrashdingiz.', 'Selam!'], ['Ko‘rsatma: kechqurun ishlatiladigan salomlashish iborasini yozing. Vaziyat: Kechqurun bir kishini ko‘rdingiz.', 'İyi akşamlar!'], ['Ko‘rsatma: mehmonni kutib olish iborasini yozing. Vaziyat: Uyingizga kelgan kishini qarshi olyapsiz.', 'Hoş geldiniz!'],
  ]),
  ...workbookGroup('d2', '2-MASHQ — 1-BOSQICH — JUDA OSON — 2-qism', 'Shart: bandlarni ketma-ket bajaring; javobni darslikdagi qoida bilan tekshiring.', 1, [
    ['Ko‘rsatma: mehmonning javob iborasini yozing. Vaziyat: Sizga “Hoş geldiniz!” deyishdi.', 'Hoş bulduk.'], ['Ko‘rsatma: xayrlashish iborasini yozing. Vaziyat: Siz ketayapsiz, suhbatdoshingiz esa qolmoqda.', 'Hoşça kal.'], ['Ko‘rsatma: qolayotgan kishining xayrlashuv iborasini yozing. Vaziyat: Suhbatdoshingiz ketmoqda, siz esa qolyapsiz.', 'Güle güle.'], ['Ko‘rsatma: yana uchrashishni bildiradigan iborani yozing. Vaziyat: Suhbat oxirida keyin yana ko‘rishishga kelishdingiz.', 'Görüşürüz.'], ['Ko‘rsatma: tanishganingizdan xursandligingizni bildiring. Vaziyat: Yangi tanish bilan qo‘l berib ko‘rishdingiz.', 'Memnun oldum.'],
  ]),
  ...workbookGroup('d2', '3-MASHQ — 2-BOSQICH — OSON — 1-qism', 'Shart: bandlarni ketma-ket bajaring; javobni darslikdagi qoida bilan tekshiring.', 2, [
    ['So‘zlardan ot-kesimli gap tuzing: Ben / öğrenci.', 'Ben öğrenciyim.'], ['So‘zlardan ot-kesimli gap tuzing: Sen / öğretmen.', 'Sen öğretmensin.'], ['So‘zlardan ot-kesimli gap tuzing: O / doktor.', 'O doktor.'], ['So‘zlardan ot-kesimli gap tuzing: Biz / mühendis.', 'Biz mühendisiz.'], ['So‘zlardan ot-kesimli gap tuzing: Siz / avukat.', 'Siz avukatsınız.'],
  ]),
  ...workbookGroup('d2', '4-MASHQ — 2-BOSQICH — OSON — 2-qism', 'Shart: bandlarni ketma-ket bajaring; javobni darslikdagi qoida bilan tekshiring.', 2, [
    ['So‘zlardan ot-kesimli gap tuzing: Ben / yorgun.', 'Ben yorgunum.'], ['So‘zlardan ot-kesimli gap tuzing: Sen / hazır.', 'Sen hazırsın.'], ['So‘zlardan ot-kesimli gap tuzing: Biz / Türk.', 'Biz Türküz.'], ['So‘zlardan ot-kesimli gap tuzing: Siz / Özbek.', 'Siz Özbek’siniz.'], ['So‘zlardan ot-kesimli gap tuzing: O / garson.', 'O garson.'],
  ]),
  ...workbookGroup('d2', '5-MASHQ — 3-BOSQICH — YO‘NALTIRILGAN — 1-qism', 'Shart: savolga to‘liq javob yozing; javobni darslikdagi qoida bilan tekshiring.', 3, [
    ['Savolga to‘liq javob yozing: Adın ne?', 'Benim adım Mert.'], ['Savolga to‘liq javob yozing: Kaç yaşındasın?', 'Yirmi yaşındayım.'], ['Savolga to‘liq javob yozing: Mesleğiniz ne?', 'Öğretmenim.'], ['Savolga to‘liq javob yozing: Nerelisiniz?', 'Özbekistanlıyım.'], ['Savolga to‘liq javob yozing: Nerede yaşıyorsun?', 'Taşkent’te yaşıyorum.'],
  ]),
  ...workbookGroup('d2', '6-MASHQ — 3-BOSQICH — YO‘NALTIRILGAN — 2-qism', 'Shart: savolga to‘liq javob yozing; javobni darslikdagi qoida bilan tekshiring.', 3, [
    ['Savolga to‘liq javob yozing: Hobin ne?', 'Hobim müzik.'], ['Savolga to‘liq javob yozing: Nasılsın?', 'İyiyim, teşekkür ederim.'], ['Savolga to‘liq javob yozing: Öğrenci misin?', 'Evet, öğrenciyim.'], ['Savolga to‘liq javob yozing: Doktor musunuz?', 'Hayır, doktor değilim.'], ['Savolga to‘liq javob yozing: Adınız ne?', 'Benim adım Saida.'],
  ]),
  ...workbookGroup('d2', '7-MASHQ — 4-BOSQICH — MUSTAQIL — 1-qism', 'Shart: xatoni tuzating; javobni darslikdagi qoida bilan tekshiring.', 4, [
    ['Xatoni tuzating: Ben doktor.', 'Ben doktorum.'], ['Xatoni tuzating: Sen öğrenciyim.', 'Sen öğrencisin.'], ['Xatoni tuzating: Biz hazırim.', 'Biz hazırız.'], ['Xatoni tuzating: Siz öğretmensin.', 'Siz öğretmensiniz.'], ['Xatoni tuzating: O mühendisim.', 'O mühendis.'],
  ]),
  ...workbookGroup('d2', '8-MASHQ — 4-BOSQICH — MUSTAQIL — 2-qism', 'Shart: xatoni tuzating; javobni darslikdagi qoida bilan tekshiring.', 4, [
    ['Xatoni tuzating: Öğrencimisin?', 'Öğrenci misin?'], ['Xatoni tuzating: Ben değil öğrenci.', 'Ben öğrenci değilim.'], ['Xatoni tuzating: Güle güle (ketayotgan odam).', 'Hoşça kal.'], ['Xatoni tuzating: Türkiyelisin? (hurmat).', 'Türkiyeli misiniz?'], ['Xatoni tuzating: Adın ne? (hurmat).', 'Adınız ne?'],
  ]),
  ...workbookGroup('d2', '9-MASHQ — 5-BOSQICH — KONTEKSTUAL', 'Shart: dialogdagi bo‘sh joyni to‘ldiring; javobni darslikdagi qoida bilan tekshiring.', 5, [
    ['A: Merhaba. Benim adım Ela. B: _____. Ben de Kerem.', 'Merhaba.'], ['A: Nerelisiniz? B: _____.', 'Özbekistanlıyım.'], ['A: Mesleğiniz ne? B: _____.', 'Mühendisim.'], ['A: Memnun oldum. B: _____.', 'Ben de memnun oldum.'], ['A: Hoş geldiniz. B: _____.', 'Hoş bulduk.'], ['A: Öğrenci misiniz? B: Hayır, _____.', 'öğrenci değilim.'], ['A: Görüşürüz. B: _____.', 'Görüşürüz.'], ['A: Hobin ne? B: _____.', 'Hobim futbol.'],
  ]),
  ...workbookGroup('d2', '10-MASHQ — 6-BOSQICH — ARALASH TAKROR — 1-qism', 'Shart: vaziyatga mos iborani yozing; javobni darslikdagi qoida bilan tekshiring.', 6, [
    ['Takrorlash (1-kun): ‘a’ harfini tasniflang.', 'qalin unli'], ['Takrorlash (1-kun): ‘e’ harfini tasniflang.', 'ingichka unli'], ['Takrorlash (1-kun): ‘ı’ harfini tasniflang.', 'qalin unli'], ['Takrorlash (1-kun): ‘i’ harfini tasniflang.', 'ingichka unli'], ['Takrorlash (1-kun): ‘o’ harfini tasniflang.', 'qalin unli'],
  ]),
  ...workbookGroup('d2', '11-MASHQ — 6-BOSQICH — ARALASH TAKROR — 2-qism', 'Shart: vaziyatga mos iborani yozing; javobni darslikdagi qoida bilan tekshiring.', 6, [
    ['Takrorlash (1-kun): ‘ö’ harfini tasniflang.', 'ingichka unli'], ['Takrorlash (1-kun): ‘u’ harfini tasniflang.', 'qalin unli'], ['Takrorlash (1-kun): ‘ü’ harfini tasniflang.', 'ingichka unli'], ['Takrorlash (1-kun): ‘b’ unlimi yoki undoshmi?', 'undosh'], ['Takrorlash (1-kun): ‘ç’ unlimi yoki undoshmi?', 'undosh'],
  ]),
  ...workbookGroup('d2', '12-MASHQ — 7-BOSQICH — CHALLENGE', 'Shart: ochiq vazifani bajaring; javob namunasi mezon bilan tekshiriladi.', 6, [
    ['Ism, yosh, shahar, kasb va hobbi haqida 5 ta sodda gap bilan o‘zingizni tanishtiring.', 'Merhaba, benim adım Ali. Yirmi yaşındayım. Taşkentliyim. Öğrenciyim. Hobim müzik.'], ['6 replikali salomlashuv va tanishuv dialogi tuzing; sen/siz shakllarini to‘g‘ri tanlang.', 'Merhaba! Benim adım Ali. Senin adın ne? Benim adım Ayşe. Memnun oldum. Ben de memnun oldum.'], ['Ben, sen, biz va siz bilan bog‘liq uchta shaxs qo‘shimchasi xatosini topib tuzating.', 'Ben öğrenciyim. Sen öğretmensin. Biz hazırız.'], ['Salomlashuvni o‘zingizni tanishtirish bilan birlashtirib, bitta qisqa vaziyat yozing.', 'Merhaba, benim adım Ali. Tanıştığımıza memnun oldum.'], ['45–60 soniya davomida ismingiz, yoshingiz, kasbingiz va qiziqishingiz haqida gapiring.', 'Benim adım Ali, yirmi yaşındayım, öğrenciyim ve müzik dinlemeyi seviyorum.'], ['Javoblaringizni shaxs qo‘shimchalari, ism gaplari va salomlashuv iboralari bo‘yicha tekshiring.', 'Mazmun tushunarli; shaxs qo‘shimchalari va salomlashuv iboralari to‘g‘ri.'],
  ]),
];

const day1Blocks: A1ContentBlockDefinition[] = [
  block(
    'objectives',
    '1-DARS. Turk Alfabesi ve Sesler — Maqsad va kirish',
    1,
    `## O'quv maqsadlari
- Turk alifbosidagi 29 harfni tartib bilan tanish va yozish.
- 8 unli va 21 undoshni ajratish; qalin va ingichka unlilarni tasniflash.
- c, ç, ğ, ı, ö, ş, ü harflarini to'g'ri o'qish va talaffuz qilish.
- So'zning oxirgi unlisiga qarab qo'shimcha shakli nega o'zgarishini anglash.
- Jarangsiz undoshlar haqidagi boshlang'ich qoidani misollarda tanish.

### Bu darsda nimalarni o'rganamiz?
- Turk alfabesi: 29 harf (Buyuk/kucuk harfler)
- Unluler ve unsuzler (Kalın/ince unluler)
- Ses uyumuna giris (Tovush uyg'unligiga kirish)
- Sert/yumusak unsuzler (Jarangsiz/jarangli undoshlar)
- Turkceye ozgu harfler ve telaffuz (Turkchaga xos harflar)

### Boshlang'ich kirish
Turk alifbosi lotin yozuviga asoslangan va **29 harfdan** iborat. Turkcha qo'shimchali til bo'lgani uchun tovushni aniq ko'rish keyingi barcha qoidalarning poydevoridir. Alifboni faqat yoddan sanash yetarli emas: harfni so'z ichida tanish, aytish va yozish kerak.`
  ),

  block(
    'alphabet-table',
    '1. Turk alifbosi: 29 harf',
    2,
    `## Turk alifbosi: 29 harf
Turk tili lotin yozuvidan foydalanadi. Alifboda 29 harf bor. Harf ketma-ketligini o'qing: **A a · B b · C c · Ç ç · D d · E e · F f · G g · Ğ ğ · H h · I ı · İ i · J j · K k · L l · M m · N n · O o · Ö ö · P p · R r · S s · Ş ş · T t · U u · Ü ü · V v · Y y · Z z**

**Q, W va X** turk alifbosining mustaqil harflari emas; ular chet tillardan kirgan nom yoki belgida uchrashi mumkin.

Harfni ko'rish, nomini aytish va tovushini eshitish bir xil ko'nikma emas: o'qishda tovushga, imloda esa harf shakliga e'tibor bering.

| Harf | O'qilishiga yaqin izoh |
| :--- | :--- |
| **A a** | a |
| **B b** | be |
| **C c** | je (o'zbekchadagi j ga yaqin) |
| **Ç ç** | che |
| **D d** | de |
| **E e** | e |
| **F f** | fe |
| **G g** | ge |
| **Ğ ğ** | yumshoq g (old unlini cho'zadi) |
| **H h** | he |
| **I ı** | nuqtasiz i |
| **İ i** | nuqtali i |
| **J j** | j (yumshoq j) |
| **K k** | ke |
| **L l** | le |
| **M m** | me |
| **N n** | ne |
| **O o** | o |
| **Ö ö** | ö (lablangan ingichka o) |
| **P p** | pe |
| **R r** | re |
| **S s** | se |
| **Ş ş** | she |
| **T t** | te |
| **U u** | u |
| **Ü ü** | ü (lablangan ingichka u) |
| **V v** | ve |
| **Y y** | ye |
| **Z z** | ze |`
  ),

  block(
    'capitalization-vowels',
    '2. Katta-kichik harf va I ı va İ i',
    3,
    `## Katta-kichik harf va I ı va İ i farqi
Turkchada ikkita alohida i tovushi bor:
- **I ı va İ i**
- **I** ning kichigi **ı** (nuqtasiz);
- **İ** ning kichigi **i** (nuqtali).

Kompyuterda yoki qo'lda yozganda nuqtani tasodifan almashtirish so'zni noto'g'ri qiladi. Gap va atoqli ot katta harf bilan boshlanadi: *İstanbul, Türkiye, Özbekistan*.

### Qoidalar va Solishtirish

| To'g'ri | Noto'g'ri | Nega? |
| :--- | :--- | :--- |
| **İstanbul** | Istanbul | Standart turk imlosida bosh harf nuqtali **İ**. |
| **ışık** | isik | **ı** va **i** boshqa tovush va boshqa harf. |
| **Türkçe** | turkce | Til nomi atoqli nomdan yasalgan va katta harf bilan yoziladi. |

Eslab qoling: Nuqtani unutish turk tilida shunchaki imlo xatosi emas — u so'zning ma'nosi va tovushini butunlay o'zgartiradi.`
  ),

  block(
    'vowels-special-letters',
    '3. Unlilar (Qalin unlilar) va maxsus harflar',
    4,
    `## Unlilar va tovush uyg'unligi (Ses Uyumu)
Unli (*unlu*) tovush havo to'siqsiz chiqadigan tovushdir. Turkchada **8 unli** bor.

### Unlilar tasnifi
- **Qalin unlilar (*kalın*):** \`a, ı, o, u\` (Misollar: *araba, kapı, okul, bulut*)
- **Ingichka unlilar (*ince*):** \`e, i, ö, ü\` (Misollar: *ev, şehir, göz, üzüm*)
- **Lablanmagan unlilar:** \`a, e, ı, i\` (Misollar: *masa, defter, kız, film*)
- **Lablangan unlilar:** \`o, ö, u, ü\` (Misollar: *otobüs, köy, kutu, gül*)

### Turkchaga xos harflarning talaffuzi

| Harf | Talaffuz yo'li | Misol |
| :--- | :--- | :--- |
| **Ç ç** | o'zbekchadagi **ch** ga to'g'ri keladi | *cam* (oyna - j), *ceket* (nimcha - j), *çay* (choy), *çocuk* (bola) |
| **Ğ ğ** | ko'pincha alohida qattiq g emas; oldingi unlini cho'zadi yoki unlilarni bog'laydi | *dağ* (tog'), *soğuk* (sovuq), *değil* (emas) |
| **I ı** | til orqaroq, nuqtasiz i | *kız* (qiz), *kapı* (eshik), *ışık* (yorug'lik) |
| **İ i** | o'zbekchadagi i ga yaqin | *iki* (iki), *şehir* (shahar) |
| **Ö ö** | o va e oralig'idagi lablangan tovush | *göz* (ko'z), *köy* (qishloq) |
| **Ş ş** | o'zbekchadagi **sh** tovushi | *şeker* (shakar), *şehir* (shahar) |
| **Ü ü** | u va i oralig'idagi lablangan tovush | *gül* (atirgul), *üzüm* (uzum) |

Muhim: **Ğ** so'z boshida odatda kelmaydi. *dağ* so'zini 'dag' deb keskin tugatmang; unli cho'ziladi. *değil* so'zida **ğ** tovushlar orasini silliq bog'laydi.`
  ),

  block(
    'consonants-errors-practice',
    '4. Undoshlar, misollar, ko\'p uchraydigan xatolar va mashqlar',
    5,
    `## Undoshlar: jarangsiz va jarangli
Undosh (*ünsüz*) aytilganda havo yo'lida to'siq bo'ladi. Boshlang'ich darajada eng muhim guruh — **jarangsiz undoshlar**:
\`f, s, t, k, ç, ş, h, p\`

Ularni **"Fıstıkçı Şahap"** eslatmasi bilan yodlash mumkin. Keyingi darslarda \`d\` bilan boshlanuvchi ayrim qo'shimchalar shu tovushlardan keyin \`t\` bo'lib keladi: *parkta, sınıfta*.

### Darsdagi misollar va to'g'ri shakllar
- To‘g‘ri: kız · Xato: kiz
- To‘g‘ri: göz · Xato: goz
- To‘g‘ri: şeker · Xato: seker
- To‘g‘ri: güzel · Xato: guzel

- **çay** — choy (\`ç = ch\`)
- **göz** — ko'z (\`ö\` ni labni yumaloqlab ayting)
- **üzüm** — uzum (ikkala \`ü\` ham ingichka lablangan)
- **ışık** — yorug'lik (ikki nuqtasiz \`ı\`)
- **şehir** — shahar (\`ş = sh\`, \`i\` nuqtali)
- **dağ** — tog' (\`ğ\` oldingi \`a\` ni cho'zadi)
- **küçük** — kichik (\`ü\` va \`ç\` ga e'tibor)
- **soğuk** — sovuq (\`ğ\` keskin g emas)
- **öğrenci** — o'quvchi/talaba (\`ö\` va \`ğ\` ketma-ketligi)
- **ağaç** — daraxt (\`ğ\` + \`ç\`)

Ko'p uchraydigan xato: **ı** va **i** ni bir xil yozish. Ular alohida harf va tovush; so'z ham, qo'shimcha ham o'zgaradi.
Ko'p uchraydigan xato: **ğ** ni qattiq "g" deb aytish. Ko'pincha oldingi unlini cho'zadi yoki silliq bog'laydi.
Ko'p uchraydigan xato: **Q/W/X** ni turk alifbosiga qo'shish. Standart turk alifbosi 29 harf.

Diqqat: Qoidani yodlashdan oldin ma'noni savol bilan aniqlang; keyin oxirgi unli va oxirgi undoshni tekshiring.`,
    day1PracticeItems
  ),
];

const day1Vocabulary = vocab([
  ['ağaç', 'daraxt', 'Ağaç büyük.', 1],
  ['çanta', 'sumka', 'Çanta burada.', 2],
  ['çay', 'choy', 'Sabah çay içiyorum.', 3],
  ['çocuk', 'bola', 'Çocuk kitap okuyor.', 4],
  ['göz', 'ko‘z', 'Göz güzel.', 5],
  ['gül', 'atirgul', 'Gül kırmızı.', 6],
  ['ıspanak', 'ismaloq', 'Ispanak sağlıklıdır.', 7],
  ['iş', 'ish', 'İş bugün yoğun.', 8],
  ['kız', 'qiz', 'Kız kitap okuyor.', 9],
  ['kitap', 'kitob', 'Bir kitap okuyorum.', 10],
  ['kalem', 'ruchka', 'Kalem masada.', 11],
  ['masa', 'stol', 'Masa burada.', 12],
  ['öğrenci', 'talaba, o‘quvchi', 'Öğrenci ders çalışıyor.', 13],
  ['öğretmen', 'o‘qituvchi', 'Öğretmen sınıfta.', 14],
  ['ev', 'uy', 'Ev küçük.', 15],
]);

const day1Questions: A1QuestionDefinition[] = [
  // 1.1 - 1.10 Multiple Choice (Special Letters) - balanced option positions
  mc('“öğrenci” so‘zidagi turkchaga xos harf(lar)ni ko‘rsating.', 'ö va ğ — turk tiliga xos harflar.', 1, ['ş, ç', 'ö, ğ', 'ü, ı', 'ü, ö'], 1),
  mc('“ışık” so‘zidagi turkchaga xos harf(lar)ni ko‘rsating.', 'ı — nuqtasiz i harfi.', 2, ['i', 'ı', 'ö', 'ü'], 1),
  mc('“şehir” so‘zidagi turkchaga xos harf(lar)ni ko‘rsating.', 'ş va i harflari.', 3, ['ğ, ı', 'ç, ü', 'ş, i', 'ö, I'], 2),
  mc('“küçük” so‘zidagi turkchaga xos harf(lar)ni ko‘rsating.', 'ü va ç harflari.', 4, ['ü, ı', 'ö, ğ', 'ş, i', 'ü, ç'], 3),
  mc('“ağaç” so‘zidagi turkchaga xos harf(lar)ni ko‘rsating.', 'ğ va ç harflari.', 5, ['ş, i', 'ğ, ç', 'ö, ü', 'ü, ı'], 1),
  mc('“üzüm” so‘zidagi turkchaga xos harf(lar)ni ko‘rsating.', 'ü — lablangan ingichka unli.', 6, ['ö', 'ı', 'ü', 'i'], 2),
  mc('“göz” so‘zidagi turkchaga xos harf(lar)ni ko‘rsating.', 'ö — lablangan ingichka unli.', 7, ['ü', 'u', 'ö', 'i'], 2),
  mc('“çocuk” so‘zidagi turkchaga xos harf(lar)ni ko‘rsating.', 'ç — o‘zbekchadagi “ch” tovushiga yaqin.', 8, ['ş', 'j', 'g', 'ç'], 3),
  mc('“soğuk” so‘zidagi turkchaga xos harf(lar)ni ko‘rsating.', 'ğ — yumshoq g.', 9, ['ç', 'ğ', 'ş', 'j'], 1),
  mc('“İstanbul” so‘zidagi turkchaga xos harf(lar)ni ko‘rsating.', 'İ — nuqtali bosh harf.', 10, ['ı', 'İ', 'I', 'i'], 1),

  // 1.11 - 1.18 Multiple Choice (Vowel Classification)
  mc('“kitap” so‘zining oxirgi unlisi qalinmi yoki ingichkami?', 'kitap so‘zidagi oxirgi unli a — qalin unli.', 11, ['so‘zda unli yo‘q', 'ingichka', 'qalin', 'aniqlab bo‘lmaydi'], 2),
  mc('“şehir” so‘zining oxirgi unlisi qalinmi yoki ingichkami?', 'şehir so‘zidagi oxirgi unli i — ingichka unli.', 12, ['aniqlab bo‘lmaydi', 'qalin', 'so‘zda unli yo‘q', 'ingichka'], 3),
  mc('“okul” so‘zining oxirgi unlisi qalinmi yoki ingichkami?', 'okul so‘zidagi oxirgi unli u — qalin unli.', 13, ['ingichka', 'qalin', 'so‘zda unli yo‘q', 'aniqlab bo‘lmaydi'], 1),
  mc('“göz” so‘zining oxirgi unlisi qalinmi yoki ingichkami?', 'göz so‘zidagi oxirgi unli ö — ingichka unli.', 14, ['aniqlab bo‘lmaydi', 'so‘zda unli yo‘q', 'ingichka', 'qalin'], 2),
  mc('“masa” so‘zining oxirgi unlisi qalinmi yoki ingichkami?', 'masa so‘zidagi oxirgi unli a — qalin unli.', 15, ['ingichka', 'so‘zda unli yo‘q', 'qalin', 'aniqlab bo‘lmaydi'], 2),
  mc('“üzüm” so‘zining oxirgi unlisi qalinmi yoki ingichkami?', 'üzüm so‘zidagi oxirgi unli ü — ingichka unli.', 16, ['aniqlab bo‘lmaydi', 'qalin', 'so‘zda unli yo‘q', 'ingichka'], 3),
  mc('“kapı” so‘zining oxirgi unlisi qalinmi yoki ingichkami?', 'kapı so‘zidagi oxirgi unli ı — qalin unli.', 17, ['ingichka', 'qalin', 'so‘zda unli yo‘q', 'aniqlab bo‘lmaydi'], 1),
  mc('“öğrenci” so‘zining oxirgi unlisi qalinmi yoki ingichkami?', 'öğrenci so‘zidagi oxirgi unli i — ingichka unli.', 18, ['so‘zda unli yo‘q', 'qalin', 'ingichka', 'aniqlab bo‘lmaydi'], 2),

  // 1.19 - 1.24 True/False
  tf('“bulut” so‘zining oxirgi unlisi qalinmi yoki ingichkami? Javob: qalin', 'u — qalin unli, shuning uchun javob To‘g‘ri.', 19, true),
  tf('“çiçek” so‘zining oxirgi unlisi qalinmi yoki ingichkami? Javob: qalin', 'e — ingichka unli, shuning uchun javob Noto‘g‘ri.', 20, false),
  tf('“araba” so‘zining oxirgi unlisi qalinmi yoki ingichkami? Javob: qalin', 'a — qalin unli, shuning uchun javob To‘g‘ri.', 21, true),
  tf('“köy” so‘zining oxirgi unlisi qalinmi yoki ingichkami? Javob: qalin', 'ö — ingichka unli, shuning uchun javob Noto‘g‘ri.', 22, false),
  tf('“cami”dagi c tovushi uchun asosiy talaffuz izohi: c = j', 'c o‘zbekchadagi j tovushiga yaqin.', 23, true),
  tf('“çay”dagi ç tovushi uchun asosiy talaffuz izohi: ç = ch', 'ç o‘zbekchadagi ch tovushiga yaqin.', 24, true),

  // 1.25 - 1.30 Missing Word / Short Answer (using missing helper with varied positions)
  missing('“şeker”dagi ş tovushi uchun asosiy talaffuz izohini kiriting:', 'ş — “sh” tovushini beradi.', 25, 'ş = sh', ['ş = s', 'ş = ch']),
  missing('“jilet”dagi j tovushi uchun asosiy talaffuz izohini kiriting:', 'j — yumshoq j tovushi.', 26, 'j = yumshoq j', ['j = j', 'j = sh']),
  missing('“dağ”dagi ğ tovushi uchun asosiy talaffuz izohini kiriting:', 'ğ oldingi unlini cho‘zadi.', 27, 'ğ oldingi unlini cho‘zadi', ['ğ = g‘', 'ğ = g']),
  missing('“kız”dagi ı tovushi uchun asosiy talaffuz izohini kiriting:', 'ı — nuqtasiz i.', 28, 'ı = nuqtasiz i', ['ı = i', 'ı = e']),
  missing('“gül”dagi ü tovushi uchun asosiy talaffuz izohini kiriting:', 'ü — lablangan ingichka unli.', 29, 'ü = lablangan ingichka unli', ['ü = u', 'ü = qalin unli']),
  missing('“göz”dagi ö tovushi uchun asosiy talaffuz izohini kiriting:', 'ö — lablangan ingichka unli.', 30, 'ö = lablangan ingichka unli', ['ö = o', 'ö = qalin unli']),
];

const day2Blocks: A1ContentBlockDefinition[] = [
  block('objectives', 'Maqsad va dialog', 1, 'Maqsadlar: salomlashish, ism, yosh, kasb, millat va qiziqish haqida sodda gapirish.\n\nDialog: — Merhaba! Benim adım Ayşe. — Merhaba Ayşe! Benim adım Ali. Tanıştığımıza memnun oldum. — Ben de memnun oldum.'),
  block('grammar', 'Ben, sen va nominal gaplar', 2, 'Turk tilida “Men o‘qituvchiman” — Ben öğretmenim. “Sen talabasan” — Sen öğrencisin. Shaxs qo‘shimchasi kesimga ulanadi: ben -im, sen -sin, u odatda qo‘shimchasiz.\n\nIsm aytish: Benim adım Yusuf. / Senin adın ne? Kasb: Ben doktorum. Millat: Ben Özbekim.'),
  block('questions', 'Yosh, kasb, millat, hobbi', 3, 'Yosh: Kaç yaşındasın? — Yirmi yaşındayım. Kasb: Ne iş yapıyorsun? — Öğretmenim. Millat: Nerelisin? — Özbekistanlıyım. Hobbi: Hobilerin neler? — Kitap okumayı seviyorum.\n\nSavolga to‘liq, muloyim javob bering: Benim adım..., ... yaşındayım, ...liyim.'),
  block('examples', 'Namuna tanishtirish', 4, 'Merhaba, benim adım Dilnoza. Yirmi iki yaşındayım. Özbekistanlıyım. Öğrenciyim. Kitap okumayı ve müzik dinlemeyi seviyorum. Tanıştığımıza memnun oldum.\n\nO‘zbekcha: Salom, mening ismim Dilnoza. Men 22 yoshdaman. O‘zbekistonlikman. Talabaman. Kitob o‘qish va musiqa tinglashni yaxshi ko‘raman.'),
  block('practice-review', 'Tanışma amaliyoti', 5, 'Workbookdagi amaliy mashqlarni ketma-ket bajaring. Ochiq topshiriqlarda avtomatik tekshiruv uchun javob namunasi berilgan.', day2PracticeItems),
];

const day2Vocabulary = vocab([
  ['Merhaba.', 'Salom.', 'Merhaba, nasılsın?', 1], ['ad (isim)', 'ism', 'Benim adım Elif.', 2], ['arkadaş', 'do‘st', 'Ali benim arkadaşım.', 3], ['bay', 'yigit', 'Bay Ali burada.', 4], ['bayan', 'ayol', 'Bayan Ayşe öğretmen.', 5], ['doktor', 'shifokor', 'Ben doktorum.', 6], ['erkek', 'erkak', 'O erkek.', 7], ['futbolcu', 'futbolchi', 'O futbolcu.', 8], ['hobi', 'hobbi', 'Hobim kitap okumak.', 9], ['kadın', 'ayol, xotin', 'Kadın öğretmen.', 10], ['mühendis', 'muhandis', 'Ben mühendisim.', 11], ['öğrenci', 'talaba, o‘quvchi', 'Ben öğrenciyim.', 12], ['öğretmen', 'o‘qituvchi', 'O öğretmen.', 13], ['okumak', 'o‘qimoq', 'Kitap okumayı seviyorum.', 14], ['sevmek', 'sevmoq', 'Müzik dinlemeyi seviyorum.', 15],
]);

const day2Questions: A1QuestionDefinition[] = [
  mc('“Mening ismim Ali”ning to‘g‘ri tarjimasi qaysi?', 'Benim adım Ali.', 1, ['Ben adım Ali.', 'Benim adım Ali.', 'Benim Ali ad.'], 1),
  mc('“Senin adın ne?” nimani so‘raydi?', 'Bu savol suhbatdoshning ismini so‘raydi.', 2, ['Yoshini', 'Ismini', 'Kasbini'], 1),
  tf('“Ben öğrenciyim” — “Men talabaman” degani.', 'öğrenciyim shakli ben bilan ishlatiladi.', 3, true),
  missing('“Men o‘qituvchiman”: Ben ___', 'Öğretmen + ben shaxs qo‘shimchasi: öğretmenim.', 4, 'öğretmenim', ['öğretmensin', 'öğretmen']),
  mc('“Kaç yaşındasın?” savoliga mos javobni tanlang.', 'Yirmi yaşındayım — Men 20 yoshdaman.', 5, ['Yirmi yaşındayım.', 'Öğretmenim.', 'Özbekistanlıyım.'], 0),
  mc('Millatni aytish uchun qaysi gap mos?', 'Nerelisin? — Özbekistanlıyım.', 6, ['Nerelisin? — Özbekistanlıyım.', 'Adın ne? — Yirmiyim.', 'Ne iş yapıyorsun? — Merhaba.'], 0),
  tf('“Tanıştığımıza memnun oldum” tanishganidan xursandlikni bildiradi.', 'Bu odobli tanishuv iborasi.', 7, true),
  missing('“Salom”ning turkcha odobli shakli: ___', 'Merhaba — salom.', 8, 'Merhaba', ['Memnun', 'Hobi']),
  mc('“Ne iş yapıyorsun?” nimani so‘raydi?', 'Bu kasb yoki ishni so‘raydi.', 9, ['Qayerdansan?', 'Nima ish qilasan?', 'Yoshing nechada?'], 1),
  mc('To‘g‘ri tanishtirishni toping.', 'Benim adım..., ... yaşındayım kabi shakllar to‘g‘ri.', 10, ['Benim adım Zeynep. Öğrenciyim.', 'Ben ad Zeynep. Öğrenci.', 'Adım benim Zeynepim.'], 0),
  tf('“Ben öğretmen” shakli boshlang‘ich nominal gap uchun to‘liq.', 'Ben öğretmenim shakli kerak.', 11, false),
  mc('“Hobilerin neler?” savoliga mos javob?', 'Kitap okumayı seviyorum — hobbi haqida javob.', 12, ['Kitap okumayı seviyorum.', 'Yirmi yaşındayım.', 'Özbekistanlıyım.'], 0),
];

const day3PracticeItems: A1PracticeItemDefinition[] = [
  ...workbookGroup('d3', '1-MASHQ — 1-BOSQICH — JUDA OSON — 1-qism', 'Shart: ko‘plik shaklini yozing va qoida bilan tekshiring.', 1, [
    ['Ko‘plik shaklini yozing: kitap → ?', 'kitaplar'], ['Ko‘plik shaklini yozing: ev → ?', 'evler'], ['Ko‘plik shaklini yozing: okul → ?', 'okullar'], ['Ko‘plik shaklini yozing: öğrenci → ?', 'öğrenciler'], ['Ko‘plik shaklini yozing: çocuk → ?', 'çocuklar'], ['Ko‘plik shaklini yozing: göz → ?', 'gözler'],
  ]),
  ...workbookGroup('d3', '2-MASHQ — 1-BOSQICH — JUDA OSON — 2-qism', 'Shart: ko‘plik shaklini yozing va qoida bilan tekshiring.', 1, [
    ['Ko‘plik shaklini yozing: masa → ?', 'masalar'], ['Ko‘plik shaklini yozing: kalem → ?', 'kalemler'], ['Ko‘plik shaklini yozing: araba → ?', 'arabalar'], ['Ko‘plik shaklini yozing: öğretmen → ?', 'öğretmenler'], ['Ko‘plik shaklini yozing: kapı → ?', 'kapılar'], ['Ko‘plik shaklini yozing: çiçek → ?', 'çiçekler'],
  ]),
  ...workbookGroup('d3', '3-MASHQ — 2-BOSQICH — OSON — 1-qism', 'Shart: birlik shaklini yozing va qoida bilan tekshiring.', 2, [
    ['Birlik shaklini yozing: arkadaşlar → ?', 'arkadaş'], ['Birlik shaklini yozing: otobüsler → ?', 'otobüs'], ['Birlik shaklini yozing: köyler → ?', 'köy'], ['Birlik shaklini yozing: masalar → ?', 'masa'], ['Birlik shaklini yozing: defterler → ?', 'defter'], ['Birlik shaklini yozing: kutular → ?', 'kutu'],
  ]),
  ...workbookGroup('d3', '4-MASHQ — 2-BOSQICH — OSON — 2-qism', 'Shart: birlik shaklini yozing va qoida bilan tekshiring.', 2, [
    ['Birlik shaklini yozing: şehirler → ?', 'şehir'], ['Birlik shaklini yozing: sınıflar → ?', 'sınıf'], ['Birlik shaklini yozing: güller → ?', 'gül'], ['Birlik shaklini yozing: telefonlar → ?', 'telefon'], ['Birlik shaklini yozing: sandalyeler → ?', 'sandalye'], ['Birlik shaklini yozing: anahtarlar → ?', 'anahtar'],
  ]),
  ...workbookGroup('d3', '5-MASHQ — 3-BOSQICH — YO‘NALTIRILGAN — 1-qism', 'Shart: so‘roq yuklamasini tanlang va qoida bilan tekshiring.', 3, [
    ['So‘roq yuklamasini tanlang: kitap ___?', 'mı'], ['So‘roq yuklamasini tanlang: ev ___?', 'mi'], ['So‘roq yuklamasini tanlang: okul ___?', 'mu'], ['So‘roq yuklamasini tanlang: öğrenci ___?', 'mi'], ['So‘roq yuklamasini tanlang: çocuk ___?', 'mu'], ['So‘roq yuklamasini tanlang: göz ___?', 'mü'],
  ]),
  ...workbookGroup('d3', '6-MASHQ — 3-BOSQICH — YO‘NALTIRILGAN — 2-qism', 'Shart: so‘roq yuklamasini tanlang va qoida bilan tekshiring.', 3, [
    ['So‘roq yuklamasini tanlang: masa ___?', 'mı'], ['So‘roq yuklamasini tanlang: kalem ___?', 'mi'], ['So‘roq yuklamasini tanlang: araba ___?', 'mı'], ['So‘roq yuklamasini tanlang: öğretmen ___?', 'mi'], ['So‘roq yuklamasini tanlang: kapı ___?', 'mı'], ['So‘roq yuklamasini tanlang: çiçek ___?', 'mi'],
  ]),
  ...workbookGroup('d3', '7-MASHQ — 4-BOSQICH — MUSTAQIL — 1-qism', 'Shart: ko‘rsatmaga ko‘ra gap tuzing.', 4, [
    ['Ko‘rsatmaga ko‘ra gap tuzing: yaqin / kitap.', 'Bu kitap.'], ['Ko‘rsatmaga ko‘ra gap tuzing: ko‘rsatilgan / masa.', 'Şu masa.'], ['Ko‘rsatmaga ko‘ra gap tuzing: uzoq / okul.', 'O okul.'], ['Ko‘rsatmaga ko‘ra gap tuzing: yaqin ko‘plik / kalem.', 'Bunlar kalemler.'], ['Ko‘rsatmaga ko‘ra gap tuzing: ko‘rsatilgan ko‘plik / çiçek.', 'Şunlar çiçekler.'],
  ]),
  ...workbookGroup('d3', '8-MASHQ — 4-BOSQICH — MUSTAQIL — 2-qism', 'Shart: ko‘rsatmaga ko‘ra gap tuzing.', 4, [
    ['Ko‘rsatmaga ko‘ra gap tuzing: uzoq ko‘plik / çocuk.', 'Onlar çocuklar.'], ['Ko‘rsatmaga ko‘ra gap tuzing: yaqin / araba / so‘roq.', 'Bu araba mı?'], ['Ko‘rsatmaga ko‘ra gap tuzing: uzoq / köy / so‘roq.', 'O köy mü?'], ['Ko‘rsatmaga ko‘ra gap tuzing: yaqin ko‘plik / öğrenci / so‘roq.', 'Bunlar öğrenciler mi?'], ['Ko‘rsatmaga ko‘ra gap tuzing: ko‘rsatilgan / otobüs / so‘roq.', 'Şu otobüs mü?'],
  ]),
  ...workbookGroup('d3', '9-MASHQ — 5-BOSQICH — KONTEKSTUAL', 'Shart: dialogdagi javobni yozing.', 5, [
    ['A: Bu ne? B: _____ (sözlük)', 'Bu bir sözlük.'], ['A: Bunlar kitaplar mı? B: _____ (ha)', 'Evet, bunlar kitaplar.'], ['A: Şu öğretmen mi? B: _____ (yo‘q/o‘quvchi)', 'Hayır, o öğrenci.'], ['A: Onlar kim? B: _____ (do‘stlar)', 'Onlar arkadaşlar.'], ['A: Bu göz mü? B: _____', 'Evet, bu göz.'], ['A: Şunlar ne? B: _____ (gullar)', 'Şunlar çiçekler.'], ['A: O okul mu? B: _____ (ha)', 'Evet, o okul.'], ['A: Bunlar üç kalemler mi?', 'Hayır, bunlar üç kalem.'],
  ]),
  ...workbookGroup('d3', '10-MASHQ — 6-BOSQICH — ARALASH TAKROR — 1-qism', 'Shart: vaziyatga mos iborani yozing.', 6, [
    ['Takrorlash (2-kun). Ko‘rsatma: salomlashish iborasini yozing. Vaziyat: Ertalab bir kishini ko‘rdingiz.', 'Günaydın!'], ['Takrorlash (2-kun). Ko‘rsatma: odatiy salomlashish iborasini yozing. Vaziyat: Kun davomida tanishingiz bilan uchrashdingiz.', 'Merhaba!'], ['Takrorlash (2-kun). Ko‘rsatma: norasmiy salomlashish iborasini yozing. Vaziyat: Yaqin do‘stingiz bilan uchrashdingiz.', 'Selam!'], ['Takrorlash (2-kun). Ko‘rsatma: kechqurun ishlatiladigan salomlashish iborasini yozing. Vaziyat: Kechqurun bir kishini ko‘rdingiz.', 'İyi akşamlar!'], ['Takrorlash (2-kun). Ko‘rsatma: mehmonni kutib olish iborasini yozing. Vaziyat: Uyingizga kelgan kishini qarshi olyapsiz.', 'Hoş geldiniz!'],
  ]),
  ...workbookGroup('d3', '11-MASHQ — 6-BOSQICH — ARALASH TAKROR — 2-qism', 'Shart: vaziyatga mos iborani yozing.', 6, [
    ['Takrorlash (2-kun). Ko‘rsatma: mehmonning javob iborasini yozing. Vaziyat: Sizga “Hoş geldiniz!” deyishdi.', 'Hoş bulduk.'], ['Takrorlash (2-kun). Ko‘rsatma: xayrlashish iborasini yozing. Vaziyat: Siz ketayapsiz, suhbatdoshingiz esa qolmoqda.', 'Hoşça kal.'], ['Takrorlash (2-kun). Ko‘rsatma: qolayotgan kishining xayrlashuv iborasini yozing. Vaziyat: Suhbatdoshingiz ketmoqda, siz esa qolyapsiz.', 'Güle güle.'], ['Takrorlash (2-kun). Ko‘rsatma: yana uchrashishni bildiradigan iborani yozing. Vaziyat: Suhbat oxirida keyin yana ko‘rishishga kelishdingiz.', 'Görüşürüz.'], ['Takrorlash (2-kun). Ko‘rsatma: tanishganingizdan xursandligingizni bildiring. Vaziyat: Yangi tanish bilan qo‘l berib ko‘rishdingiz.', 'Memnun oldum.'],
  ]),
  ...workbookGroup('d3', '12-MASHQ — 7-BOSQICH — CHALLENGE', 'Shart: ochiq vazifani bajaring; javob namunasi mezon bilan tekshiriladi.', 6, [
    ['Bu, şu va o bilan 5 ta birlik gap tuzing.', 'Bu kitap. Şu masa. O okul. Bu kalem. Şu çiçek.'], ['6 replikali dialogda mı/mi/mu/mü so‘roq yuklamalaridan kamida to‘rttasini ishlating.', 'Bu kitap mı? Bu ev mi? O okul mu? Şu göz mü?'], ['Ko‘plik, ko‘rsatish olmoshi va so‘roq yuklamasidagi uchta xatoni tuzating.', 'Bunlar kitaplar. Şunlar kalemler. Bu ev mi?'], ['Ko‘rsatish olmoshi + ko‘plik + so‘roq shaklini uchta yangi misolda birlashtiring.', 'Bunlar öğrenciler mi? Şunlar çiçekler mi? Onlar çocuklar mı?'], ['Ko‘rsatilgan buyumlar haqida 45–60 soniyali savol-javob dialogini ayting.', 'Bu ne? Bu bir kitap. Şunlar ne? Şunlar çiçekler.'], ['Javoblaringizni -lar/-ler, bu/şu/o va mı/mi/mu/mü qoidalari bo‘yicha tekshiring.', 'Mazmun tushunarli; ko‘plik, ko‘rsatish olmoshi va so‘roq yuklamasi to‘g‘ri.'],
  ]),
];

const day3Blocks: A1ContentBlockDefinition[] = [
  block('objectives', 'Maqsad va ko‘rsatish', 1, 'Maqsadlar: -lar/-ler ko‘plik qo‘shimchasini, bu/şu/o va bunlar/şunlar/onlar ko‘rsatish so‘zlarini, mı/mi/mu/mü savol yuklamasini ishlatish.\n\nYaqin narsaga bu, biroz naridagiga şu, uzoq yoki oldindan ma’lum narsaga o ishlatiladi.'),
  block('plural', 'Ko‘plik: -lar / -ler', 2, 'Oxirgi unli qalin bo‘lsa -lar: kitaplar, çocuklar, arabalar. Ingichka bo‘lsa -ler: evler, gözler, öğrenciler. Son, miqdor yoki ko‘plik ma’nosi allaqachon ma’lum bo‘lsa ko‘plikni takrorlamang: üç kitap (uchta kitob), üç kitaplar emas.'),
  block('demonstratives', 'Bu, şu, o va ko‘plik shakllari', 3, 'Bu kitap. (Bu kitob.) Şu kalem. (Ana u ruchka.) O masa. (U stol.) Ko‘plik: Bunlar kitaplar, şunlar kalemler, onlar masalar.\n\nSavol-javob: Bu ne? — Bu bir kitap. Bunlar ne? — Bunlar kitaplar. O kim? — O öğretmen.'),
  block('questions', 'mı / mi / mu / mü', 4, 'Savol yuklamasi alohida yoziladi va oldingi so‘zning oxirgi unlisiga moslashadi: a/ı → mı (Bu kitap mı?), e/i → mi (Bu ev mi?), o/u → mu (O okul mu?), ö/ü → mü (Şu gözlük mü?). Shaxs qo‘shimchasi yuklamaga ulanadi: Öğrenci misin? Öğretmen miyim?\n\nInkor: Bu kitap değil. Savol-inkor: Bu kitap değil mi?'),
  block('practice-review', 'Çoğul, işaret va soru amaliyoti', 5, 'Workbookdagi amaliy mashqlarni ketma-ket bajaring. Ochiq topshiriqlarda avtomatik tekshiruv uchun javob namunasi berilgan.', day3PracticeItems),
];

const day3Vocabulary = vocab([
  ['bardak', 'stakan', 'Bu bardak.', 1], ['burada', 'bu yerda', 'Kitap burada.', 2], ['çanta', 'sumka', 'Bu çanta değil.', 3], ['çocuk', 'bola', 'Bunlar çocuklar.', 4], ['defter', 'daftar', 'Şu defter mi?', 5], ['ev', 'uy', 'Bu ev mi?', 6], ['göz', 'ko‘z', 'Şu göz mü?', 7], ['kalem', 'ruchka', 'Şu kalem mi?', 8], ['kapı', 'eshik', 'O kapı.', 9], ['kitap', 'kitob', 'Bunlar kitaplar.', 10], ['kutu', 'quti', 'Bu kutu.', 11], ['masa', 'stol', 'O masa.', 12], ['oda', 'xona', 'Bu oda mı?', 13], ['pencere', 'deraza', 'Şu pencere.', 14], ['sandalye', 'stul', 'Şunlar sandalyeler.', 15],
]);

const day3Questions: A1QuestionDefinition[] = [
  mc('“ev” so‘zining ko‘plik shakli qaysi?', 'e ingichka unli, shuning uchun evler.', 1, ['evlar', 'evler', 'evs'], 1),
  mc('Yaqin narsani ko‘rsatish uchun qaysi so‘z ishlatiladi?', 'Bu yaqin narsa uchun.', 2, ['O', 'Şu', 'Bu'], 2),
  tf('Savol yuklamasi alohida yoziladi: Bu kitap mı?', 'mı alohida yoziladi.', 3, true),
  missing('“Bu bir maktabmi?”: Bu bir ___ mu?', 'okul o unlisi bilan tugaydi, shuning uchun mu.', 4, 'okul', ['okulı', 'okuler']),
  mc('“Bunlar ne?” savoliga mos javobni toping.', 'Bunlar ko‘plik narsalar haqida: kitaplar.', 5, ['Bunlar kitaplar.', 'Bu bir kitap.', 'O öğretmen.'], 0),
  mc('“göz” bilan qaysi savol yuklamasi keladi?', 'ö/ü guruhiga mü mos.', 6, ['mı', 'mi', 'mü'], 2),
  tf('Üchta kitob uchun “üç kitaplar” deyish kerak.', 'Miqdor ko‘rsatilganda odatda üç kitap deyiladi.', 7, false),
  missing('“Bu ruchka emas”: Bu kalem ___.', 'değil — emas.', 8, 'değil', ['mi', 'ler']),
  mc('“O kim?” nimani so‘raydi?', 'kim — odamning kimligini so‘raydi.', 9, ['Nima?', 'Kim?', 'Qayerda?'], 1),
  mc('Qaysi shakl to‘g‘ri?', 'Savol yuklamasi so‘zdan keyin alohida keladi.', 10, ['Kitapmı?', 'Kitap mı?', 'Mı kitap?'], 1),
  tf('“Bunlar” ko‘plikdagi yaqin narsalarni ko‘rsatishi mumkin.', 'Bu ning ko‘plik shakli bunlar.', 11, true),
  mc('“O okul mu?” jumlasining ma’nosi?', 'O okul mu? — U maktabmi?', 12, ['U maktabmi?', 'Bu kitobmi?', 'U kim?'], 0),
];

// Day 4: İsim Halleri (-A, -DA, -DAn)
const day4Blocks: A1ContentBlockDefinition[] = [
  block('objectives', '4-DARS. İsim Halleri — Maqsad va kirish', 1, `## O'quv maqsadlari\n- Yo'nalish kelishigi -(y)A, o'rin-payt -DA va chiqish kelishigi -DAn qo'llash.\n- Tovush uyg'unligini (a/e, da/de/ta/te, dan/den/tan/ten) to'g'ri tanlash.\n- Ish, maktab, uy va shahar yo'nalishlarida gap tuzish.`),
  block('grammar-a', '1. Yo‘nalish kelishigi: -(y)A', 2, `## Yo'nalish kelishigi: -(y)A (ga/ka/qa)\nOxirgi unli qalin bo'lsa **-a**, ingichka bo'lsa **-e**. Unli bilan tugasa **-ya / -ye** ulanadi.\n\n- okula (maktabga)\n- eve (uyga)\n- sinemaya (sinemaga)\n- parka (parkka)`),
  block('grammar-da', '2. O‘rin-payt kelishigi: -DA', 3, `## O'rin-payt kelishigi: -DA (da/ta)\nOxirgi unli qalin bo'lsa **-da**, ingichka bo'lsa **-de**. Jarangsiz undosh (*Fıstıkçı Şahap*) dan keyin **-ta / -te** bo'ladi.\n\n- okulda (maktabda)\n- evde (uyda)\n- parkta (parkda)\n- sınıfta (sinfda)`),
  block('grammar-dan', '3. Chiqish kelishigi: -DAn', 4, `## Chiqish kelishigi: -DAn (dan/tan)\nOxirgi unli qalin bo'lsa **-dan**, ingichka bo'lsa **-den**. Jarangsiz undoshdan keyin **-tan / -ten** bo'ladi.\n\n- okuldan (maktabdan)\n- evden (uydan)\n- parktan (parkdan)\n- işten (ishdan)`),
  block('practice-review', 'Bosqichma-bosqich mashqlar', 5, '1) okula gapini yo‘nalish bilan to‘ldiring. 2) evde gapini o‘rin-payt bilan to‘ldiring. 3) işten gapini chiqish kelishigi bilan to‘ldiring.', day1PracticeItems),
];
const day4Vocabulary = vocab([['okul', 'maktab', 'Okula gidiyorum.', 1], ['ev', 'uy', 'Evden çıkıyorum.', 2], ['iş', 'ish', 'İşteyim.', 3], ['park', 'park', 'Parkta yürüyorum.', 4], ['sınıf', 'sinf', 'Sınıfta öğretmen var.', 5]]);
const day4Questions: A1QuestionDefinition[] = [
  mc('“eve” qaysi kelishikda?', 'eve — yo‘nalish kelishigida.', 1, ['O‘rin-payt', 'Yo‘nalish', 'Chiqish'], 1),
  mc('“okulda” qaysi kelishikda?', 'okulda — o‘rin-payt kelishigida.', 2, ['Chiqish', 'Yo‘nalish', 'O‘rin-payt'], 2),
  tf('“parkta” jarangsiz undosh tufayli -ta bo‘lgan.', 'k harfi jarangsiz undosh.', 3, true),
  missing('“Uyga ketayapman”: ___ gidiyorum.', 'Ev + e = eve.', 4, 'Eve', ['Evda', 'Evden']),
];

// Day 5: Zaman ve Sınır
const day5Blocks: A1ContentBlockDefinition[] = [
  block('objectives', '5-DARS. Zaman ve Sınır — Maqsad va kirish', 1, `## O'quv maqsadlari\n- -DAn ...(y)A kadar bilan vaqt va masofa oralig'ini aytish.\n- -DAn önce va -DAn sonra orqali ketma-ketlikni ko'rsatish.`),
  block('kadar', '1. -DAn ...(y)A kadar (dan ...gacha)', 2, `## Vaqt va masofa oralig'i\n- Saat dokuzdan beşe kadar çalışıyorum. (Soat 9 dan 5 gacha ishlayman.)\n- Evden okula kadar yürüyorum. (Uydan maktabgacha piyoda boraman.)`),
  block('once-sonra', '2. -DAn önce va -DAn sonra', 3, `## Oldin va keyin\n- Dersten önce (darsdan oldin)\n- Dersten sonra (darsdan keyin)\n- Yemekten önce ellerini yıka. (Ovqatdan oldin qo'lingni yuv.)`),
  block('practice-review', 'Bosqichma-bosqich mashqlar', 4, 'Mashqlarni bajaring: 1) sabahtan akşama kadar. 2) dersten önce.', day1PracticeItems),
];
const day5Vocabulary = vocab([['sabah', 'ertalab', 'Sabahtan akşama kadar.', 1], ['akşam', 'kechqurun', 'Akşam eve geliyorum.', 2], ['önce', 'oldin', 'Yemekten önce.', 3], ['sonra', 'keyin', 'Dersten sonra.', 4]]);
const day5Questions: A1QuestionDefinition[] = [
  mc('“Dersten önce” ma’nosi nima?', 'Dersten önce — darsdan oldin.', 1, ['Darsdan keyin', 'Darsdan oldin', 'Dars vaqtida'], 1),
  tf('“saat 9\'dan 5\'e kadar” soat oralig‘ini bildiradi.', 'To‘g‘ri vaqt oralig‘i.', 2, true),
];

// Day 6: Öncelik-Sonralık-Süre
const day6Blocks: A1ContentBlockDefinition[] = [
  block('objectives', '6-DARS. Öncelik-Sonralık-Süre — Maqsad', 1, `## O'quv maqsadlari\n- -mAdAn önce va -DIktAn sonra bilan fe'l harakatlari ketma-ketligini tuzish.\n- -DAn beri va -DIr bilan davomiylikni ifodalash.`),
  block('grammar', "1. Fe'l qo'shimchalari: -mAdAn önce / -DIktAn sonra", 2, `## Harakat ketma-ketligi\n- Yemek yemeden önce (ovqat yeyishdan oldin)\n- Kitap okuduktan sonra (kitob o'qigandan keyin)`),
  block('duration', '2. Davomiylik: -DAn beri va -DIr', 3, `## Davomiylik ifodasi\n- İki yıldan beri burada yaşıyorum. (İki yildan beri bu yerda yashayman.)\n- Üç yıldır Türkçe öğreniyorum. (Üch yildan beri turkcha o'rganyapman.)`),
  block('practice-review', '3. Bosqichma-bosqich mashqlar', 4, '1) uyumadan önce. 2) geldikten sonra.', day1PracticeItems),
];
const day6Vocabulary = vocab([['önce', 'oldin', 'Uyumadan önce.', 1], ['sonra', 'keyin', 'Geldikten sonra.', 2], ['yıl', 'yil', 'İki yıldır.', 3]]);
const day6Questions: A1QuestionDefinition[] = [
  mc('“uyumadan önce” ma’nosi?', 'uyumadan önce — uxlashdan oldin.', 1, ['Uxlashdan keyin', 'Uxlashdan oldin', 'Uxlayotganda'], 1),
  tf('“-DIktAn sonra” harakat tugagandan keyingi ishni bildiradi.', 'To‘g‘ri.', 2, true),
];

// Day 7: Sayılar ve Karşılaştırma
const day7Blocks: A1ContentBlockDefinition[] = [
  block('objectives', '7-DARS. Sayılar ve Karşılaştırma — Maqsad', 1, `## O'quv maqsadlari\n- Sonlarni 1000 gacha sanash.\n- -(I)ncI bilan tartib sonlarini yozish.\n- daha va en bilan solishtirish.`),
  block('numbers', '1. Sonlar va tartib sonlar', 2, `## Sonlar\n- bir, iki, üç, dört, beş, altı, yedi, sekiz, dokuz, on\n- yirmi, otuz, kırk, elli, altmış, yetmiş, seksen, doksan, yüz\n- Tartib son: birinci, ikinci, üçüncü, dördüncü, beşinci.`),
  block('comparison', '2. daha va en', 3, `## Solishtirish\n- Ali Ahmet'ten daha uzun. (Ali Ahmetdan uzunroq.)\n- En büyük şehir İstanbul. (Eng katta shahar Istanbul.)`),
  block('practice-review', '3. Bosqichma-bosqich mashqlar', 4, '1) 1-10 sonlar. 2) daha va en bilan gaplar.', day1PracticeItems),
];
const day7Vocabulary = vocab([['birinci', 'birinchi', 'Birinci sınıf.', 1], ['daha', 'yana / -roq', 'Daha büyük.', 2], ['en', 'eng', 'En güzel.', 3]]);
const day7Questions: A1QuestionDefinition[] = [
  mc('“En büyük” ma’nosi nima?', 'En büyük — eng katta.', 1, ['Kattaroq', 'Eng katta', 'Kichik'], 1),
  tf('“daha” ikki narsani solishtirish uchun ishlatiladi.', 'To‘g‘ri.', 2, true),
];

// Day 8: Zamirler ve İyelik
const day8Blocks: A1ContentBlockDefinition[] = [
  block('objectives', '8-DARS. Zamirler ve İyelik — Maqsad', 1, `## O'quv maqsadlari\n- Shaxs olmoshlari (ben, sen, o, biz, siz, onlar).\n- Egalik qo'shimchalari (benim evim, senin evin, onun evi).`),
  block('pronouns', '1. Shaxs olmoshlari', 2, `## Shaxs olmoshlari\n- Ben (men), Sen (sen), O (u)\n- Biz (biz), Siz (siz), Onlar (ular)`),
  block('possessive', '2. Egalik qo‘shimchalari', 3, `## Egalik qo'shimchalari\n- benim ev-im (mening uyim)\n- senin ev-in (sening uying)\n- onun ev-i (uning uyi)\n- bizim ev-imiz (bizning uyimiz)\n- sizin ev-iniz (sizing uyingiz)\n- onların ev-leri (ularning uylari)`),
  block('practice-review', '3. Bosqichma-bosqich mashqlar', 4, '1) benim arabam. 2) senin kitabın.', day1PracticeItems),
];
const day8Vocabulary = vocab([['benim', 'mening', 'Benim evim.', 1], ['senin', 'sening', 'Senin kitabın.', 2], ['onun', 'uning', 'Onun arabası.', 3]]);
const day8Questions: A1QuestionDefinition[] = [
  mc('“benim evim” nimani bildiradi?', 'benim evim — mening uyim.', 1, ['Sening uying', 'Mening uyim', 'Uning uyi'], 1),
  tf('“onun arabası” s unli uyg‘unligida bog‘lovchi bo‘lib kelgan.', 'To‘g‘ri.', 2, true),
];

// Day 9: Belirli Nesne + Şimdiki Zaman
const day9Blocks: A1ContentBlockDefinition[] = [
  block('objectives', '9-DARS. Belirli Nesne + Şimdiki Zaman — Maqsad', 1, `## O'quv maqsadlari\n- Aniq to'ldiruvchi -(y)I qo'llash.\n- -yor hozirgi davom zamon fe'lini tuslash.`),
  block('accusative', '1. Aniq to‘ldiruvchi: -(y)I', 2, `## Aniq to'ldiruvchi\n- Kitabı okuyorum. (Kitobni o'qiyapman.)\n- Kapıyı açıyorum. (Eshikni ochgapman.)`),
  block('present-continuous', '2. -yor Hozirgi zamon', 3, `## -yor Tuslanishi\n- Ben okuyorum. (Men o'qiyapman.)\n- Sen okuyorsun. (Sen o'qiyapsan.)\n- O okuyor. (U o'qiyapti.)\n- Biz okuyoruz. (Biz o'qiyapmiz.)\n- Siz okuyorsunuz. (Siz o'qiyapsiz.)\n- Onlar okuyorlar. (Ular o'qishyapti.)`),
  block('practice-review', '3. Bosqichma-bosqich mashqlar', 4, '1) Kitabı okuyorum. 2) Çayı içiyorum.', day1PracticeItems),
];
const day9Vocabulary = vocab([['okumak', 'o‘qimoq', 'Kitap okuyorum.', 1], ['yazmak', 'yozmoq', 'Mektup yazıyorum.', 2], ['içmek', 'ichmoq', 'Çay içiyorum.', 3]]);
const day9Questions: A1QuestionDefinition[] = [
  mc('“Ben okuyorum” fe’li qaysi zamonda?', 'Hozirgi davom zamoni (-yor).', 1, ['O‘tgan zamon', 'Hozirgi zamon', 'Kelasi zamon'], 1),
  tf('“Kitabı okuyorum” gapida kitabı aniq to‘ldiruvchidir.', 'To‘g‘ri.', 2, true),
];

// Day 10: İstemek + Yapım Ekleri
const day10Blocks: A1ContentBlockDefinition[] = [
  block('objectives', '10-DARS. İstemek + Yapım Ekleri — Maqsad', 1, `## O'quv maqsadlari\n- -mak istemek bilan istak ifodalash.\n- -lI/-sIz yasovchi qo'shimchalarini ishlatish.`),
  block('istemek', '-mak istemek (istamoq)', 2, `## Istak bildirish\n- Türkçe öğrenmek istiyorum. (Turkcha o'rganishni xohlayman.)\n- Çay içmek istiyor musun? (Choy ichishni istaysanmi?)`),
  block('suffixes', '-lI va -sIz', 3, `## Sifat yasovchilar\n- şekerli (shakarli) / şekersiz (shakarsiz)\n- sütlü (sutli) / sütsüz (sutsiz)`),
  block('practice-review', 'Bosqichma-bosqich mashqlar', 4, '1) çay içmek istiyorum. 2) şekersiz kahve.', day1PracticeItems),
];
const day10Vocabulary = vocab([['istemek', 'istamoq', 'Gitmek istiyorum.', 1], ['şekerli', 'shakarli', 'Şekerli çay.', 2], ['şekersiz', 'shakarsiz', 'Şekersiz kahve.', 3]]);
const day10Questions: A1QuestionDefinition[] = [
  mc('“gitmek istiyorum” ma’nosi nima?', 'gitmek istiyorum — ketishni istayman.', 1, ['Ketishni istamayman', 'Ketishni istayman', 'Kelyapman'], 1),
  tf('“şekersiz” shakarsiz degani.', 'To‘g‘ri.', 2, true),
];

// Day 11: Saatler
const day11Blocks: A1ContentBlockDefinition[] = [
  block('objectives', '11-DARS. Saatler — Maqsad va kirish', 1, `## O'quv maqsadlari\n- Butun va yarim soatni aytish.\n- -(y)I geçiyor va -(y)A var bilan minutlarni ko'rsatish.`),
  block('clock-telling', '1. Soatni aytish qoidalari', 2, `## Vaqtni aytish\n- Saat dokuz. (Soat 9:00)\n- Saat dokuz buçuk. (Soat 9:30)\n- Saat dokuzu on geçiyor. (Soat 9:10 - 9 dan 10 minut o'tdi)\n- Saat dokuza on var. (Soat 8:50 - 9 ga 10 minut qoldi)`),
  block('day-night', '2. Gece va gündüz ifodalari', 3, `## Kun va tun qismlari\n- Sabah saat sekiz. (Ertalab soat 8)\n- Gece saat on bir. (Tunda soat 11)`),
  block('practice-review', '3. Bosqichma-bosqich mashqlar', 4, '1) saat kaç? 2) saat on geçiyor.', day1PracticeItems),
];
const day11Vocabulary = vocab([['saat', 'soat', 'Saat kaç?', 1], ['buçuk', 'yarim', 'Saat bir buçuk.', 2], ['çeyrek', 'chorak', 'Çeyrek geçiyor.', 3]]);
const day11Questions: A1QuestionDefinition[] = [
  mc('“Saat kaç?” nimani so‘raydi?', 'Saat kaç? — Soat necha?', 1, ['Qayerda?', 'Soat necha?', 'Kim bu?'], 1),
  tf('“buçuk” soati 30 minut (yarim) ekanini bildiradi.', 'To‘g‘ri.', 2, true),
];

// Day 12: İsim Tamlamaları + A1 Entegrasyon
const day12PracticeItems: A1PracticeItemDefinition[] = [
  ...workbookGroup('d12', '1-MASHQ — 1-BOSQICH — JUDA OSON — 1-qism', 'Shart: belirtili isim tamlaması tuzing.', 1, [
    ['Belirtili isim tamlaması tuzing: ev / kapı.', 'evin kapısı'], ['Belirtili isim tamlaması tuzing: okul / bahçe.', 'okulun bahçesi'], ['Belirtili isim tamlaması tuzing: öğrenci / kitap.', 'öğrencinin kitabı'], ['Belirtili isim tamlaması tuzing: araba / renk.', 'arabanın rengi'], ['Belirtili isim tamlaması tuzing: şehir / merkez.', 'şehrin merkezi'], ['Belirtili isim tamlaması tuzing: kitap / kapak.', 'kitabın kapağı'],
  ]),
  ...workbookGroup('d12', '2-MASHQ — 1-BOSQICH — JUDA OSON — 2-qism', 'Shart: belirtili isim tamlaması tuzing.', 1, [
    ['Belirtili isim tamlaması tuzing: çocuk / oda.', 'çocuğun odası'], ['Belirtili isim tamlaması tuzing: öğretmen / masa.', 'öğretmenin masası'], ['Belirtili isim tamlaması tuzing: Türkiye / başkent.', 'Türkiye’nin başkenti'], ['Belirtili isim tamlaması tuzing: sınıf / pencere.', 'sınıfın penceresi'], ['Belirtili isim tamlaması tuzing: telefon / numara.', 'telefonun numarası'], ['Belirtili isim tamlaması tuzing: otobüs / durak.', 'otobüsün durağı'],
  ]),
  ...workbookGroup('d12', '3-MASHQ — 2-BOSQICH — OSON — 1-qism', 'Shart: tamlama qismlarini ajrating.', 2, [
    ['Tamlama qismlarini ajrating: evin kapısı.', 'ev / kapı'], ['Tamlama qismlarini ajrating: okulun müdürü.', 'okul / müdür'], ['Tamlama qismlarini ajrating: şehrin merkezi.', 'şehir / merkez'], ['Tamlama qismlarini ajrating: öğretmenin kitabı.', 'öğretmen / kitap'], ['Tamlama qismlarini ajrating: arabanın anahtarı.', 'araba / anahtar'], ['Tamlama qismlarini ajrating: çocuğun annesi.', 'çocuk / anne'],
  ]),
  ...workbookGroup('d12', '4-MASHQ — 2-BOSQICH — OSON — 2-qism', 'Shart: tamlama qismlarini ajrating.', 2, [
    ['Tamlama qismlarini ajrating: Türkiye’nin başkenti.', 'Türkiye / başkent'], ['Tamlama qismlarini ajrating: masanın rengi.', 'masa / renk'], ['Tamlama qismlarini ajrating: sınıfın kapısı.', 'sınıf / kapı'], ['Tamlama qismlarini ajrating: kitabın sayfası.', 'kitap / sayfa'], ['Tamlama qismlarini ajrating: evin odası.', 'ev / oda'], ['Tamlama qismlarini ajrating: trenin istasyonu.', 'tren / istasyon'],
  ]),
  ...workbookGroup('d12', '5-MASHQ — 3-BOSQICH — YO‘NALTIRILGAN — 1-qism', 'Shart: xatoni tuzating.', 3, [
    ['Xatoni tuzating: Okul kapısı açık. (aniq maktabning)', 'Okulun kapısı açık.'], ['Xatoni tuzating: Öğrencinin kitap masada.', 'Öğrencinin kitabı masada.'], ['Xatoni tuzating: Arabanın renkisi kırmızı.', 'Arabanın rengi kırmızı.'], ['Xatoni tuzating: Türkiye başkenti Ankara.', 'Türkiye’nin başkenti Ankara.'], ['Xatoni tuzating: Çocukın odası küçük.', 'Çocuğun odası küçük.'],
  ]),
  ...workbookGroup('d12', '6-MASHQ — 3-BOSQICH — YO‘NALTIRILGAN — 2-qism', 'Shart: xatoni tuzating.', 3, [
    ['Xatoni tuzating: Kitapın kapağı mavi.', 'Kitabın kapağı mavi.'], ['Xatoni tuzating: Masanın renk kahverengi.', 'Masanın rengi kahverengi.'], ['Xatoni tuzating: Öğretmen masası (o‘qituvchining ma’lum stoli).', 'Öğretmenin masası.'], ['Xatoni tuzating: Sınıfın pencere açık.', 'Sınıfın penceresi açık.'], ['Xatoni tuzating: Şehirin merkezi kalabalık.', 'Şehrin merkezi kalabalık.'],
  ]),
  ...workbookGroup('d12', '7-MASHQ — 4-BOSQICH — MUSTAQIL — 1-qism', 'Shart: A1 qoidalarini birlashtirib gap tuzing.', 4, [
    ['A1 qoidalarini birlashtirib gap tuzing: Ben / 22 / Taşkent / öğrenci.', 'Ben yirmi iki yaşındayım, Taşkentliyim ve öğrenciyim.'], ['A1 qoidalarini birlashtirib gap tuzing: bu / kitap / so‘roq / ko‘plik.', 'Bunlar kitaplar mı?'], ['A1 qoidalarini birlashtirib gap tuzing: ev / okul / qayerdan-qayerga.', 'Evden okula gidiyorum.'], ['A1 qoidalarini birlashtirib gap tuzing: 09:00–13:00 / dars.', 'Dersler dokuzdan bire kadar.'], ['A1 qoidalarini birlashtirib gap tuzing: chiqishdan oldin / eshikni yopmoq.', 'Çıkmadan önce kapıyı kapatıyorum.'], ['A1 qoidalarini birlashtirib gap tuzing: 2025 / beri / turkcha o‘rganmoq.', '2025’ten beri Türkçe öğreniyorum.'],
  ]),
  ...workbookGroup('d12', '8-MASHQ — 4-BOSQICH — MUSTAQIL — 2-qism', 'Shart: A1 qoidalarini birlashtirib gap tuzing.', 4, [
    ['A1 qoidalarini birlashtirib gap tuzing: tren / otobüs / tezroq.', 'Tren otobüsten daha hızlı.'], ['A1 qoidalarini birlashtirib gap tuzing: mening / kitob.', 'Benim kitabım.'], ['A1 qoidalarini birlashtirib gap tuzing: hozir / kitobni o‘qimoq.', 'Şu anda kitabı okuyorum.'], ['A1 qoidalarini birlashtirib gap tuzing: muzeyga bormoq / xohlamoq.', 'Müzeye gitmek istiyorum.'], ['A1 qoidalarini birlashtirib gap tuzing: 09:45.', 'Ona çeyrek var.'], ['A1 qoidalarini birlashtirib gap tuzing: maktabning bog‘i.', 'Okulun bahçesi.'],
  ]),
  ...workbookGroup('d12', '9-MASHQ — 5-BOSQICH — KONTEKSTUAL', 'Shart: matn asosida javob bering.', 5, [
    ['Matn: Ali saat dokuzdan beri okulda. İki saattir Türkçe öğreniyor. Ne zamandan beri okulda?', 'Saat dokuzdan beri.'], ['Matn: Ayşe’nin çantası masada. Çantayı kim kullanıyor?', 'Ayşe.'], ['Matn: Tren otobüsten daha hızlı. Hangisi daha yavaş?', 'Otobüs.'], ['Matn: Ders ona çeyrek kala başlıyor. Ders kaçta?', '09:45.'], ['Matn: Mehmet eve geldikten sonra kitabı okuyor. Önce ne yapıyor?', 'Eve geliyor.'], ['Matn: Bu telefon benim telefonumdan daha ucuz. Qaysi telefon qimmatroq?', 'Benim telefonum.'], ['Matn: Yarınki toplantıya gitmek istemiyorum. Istak ijobiymi?', 'Yo‘q, inkor.'], ['Matn: Okulun kapısı parkta değil. Qayerda emas?', 'Parkta değil.'],
  ]),
  ...workbookGroup('d12', '10-MASHQ — 6-BOSQICH — ARALASH TAKROR — 1-qism', 'Shart: vaqtni turkcha ayting.', 6, [
    ['Takrorlash (11-kun): Vaqtni turkcha ayting: 03:00.', 'Saat üç.'], ['Takrorlash (11-kun): Vaqtni turkcha ayting: 07:00.', 'Saat yedi.'], ['Takrorlash (11-kun): Vaqtni turkcha ayting: 12:30.', 'Saat on iki buçuk.'], ['Takrorlash (11-kun): Vaqtni turkcha ayting: 05:30.', 'Saat beş buçuk.'], ['Takrorlash (11-kun): Vaqtni turkcha ayting: 09:15.', 'Saat dokuzu çeyrek geçiyor.'],
  ]),
  ...workbookGroup('d12', '11-MASHQ — 6-BOSQICH — ARALASH TAKROR — 2-qism', 'Shart: vaqtni turkcha ayting.', 6, [
    ['Takrorlash (11-kun): Vaqtni turkcha ayting: 03:15.', 'Saat üçü çeyrek geçiyor.'], ['Takrorlash (11-kun): Vaqtni turkcha ayting: 03:45.', 'Saat dörde çeyrek var.'], ['Takrorlash (11-kun): Vaqtni turkcha ayting: 08:45.', 'Saat dokuza çeyrek var.'], ['Takrorlash (11-kun): Vaqtni turkcha ayting: 10:30.', 'Saat on buçuk.'], ['Takrorlash (11-kun): Vaqtni turkcha ayting: 01:00.', 'Saat bir.'],
  ]),
  ...workbookGroup('d12', '12-MASHQ — 7-BOSQICH — CHALLENGE', 'Shart: ochiq vazifani bajaring; javob namunasi mezon bilan tekshiriladi.', 6, [
    ['Isim tamlamasi bilan 5 ta egalik/qarashlilik gapini tuzing.', 'Evin kapısı açık. Okulun bahçesi büyük. Kitabın kapağı mavi. Öğretmenin masası temiz. Şehrin merkezi kalabalık.'], ['A1 mavzularidan kamida to‘rttasini bitta qisqa dialogda birlashtiring.', 'Merhaba, benim adım Ali. Saat kaç? Saat üç. Bu kitap mı? Evet, bu kitap.'], ['Kelishik, egalik va fe’l shakllaridagi uchta xatoni topib tuzating.', 'Okulun kapısına gidiyorum. Benim kitabım masada. Türkçe öğreniyorum.'], ['Vaqt, joy, taqqoslash va istakni bitta kundalik vaziyatda ifodalang.', 'Saat dokuzda okuldayım. Tren otobüsten hızlı. Müzeye gitmek istiyorum.'], ['45–60 soniya davomida o‘zingizning to‘liq A1 tanishtiruvingizni ayting.', 'Benim adım Ali. Yirmi yaşındayım. Taşkentliyim. Öğrenciyim. Türkçe öğreniyorum.'], ['Javoblaringizni tamlama, kelishik, egalik, zaman va hozirgi zamon mavzulari bo‘yicha tekshiring.', 'Mazmun tushunarli; tamlama, kelishik, egalik va zaman shakllari to‘g‘ri.'],
  ]),
];

const day12Blocks: A1ContentBlockDefinition[] = [
  block('objectives', '12-DARS. İsim Tamlamaları + A1 Entegrasyon — Maqsad', 1, `## O'quv maqsadlari\n- Belirtili isim tamlaması (okulun kapısı) tuzish.\n- A1 darajasining barcha grammatik mavzularini takrorlash va integratsiyalash.`),
  block('possessive-constructions', 'Belirtili İsim Tamlaması', 2, `## Aniq ot birikmasi\n- okul-un kapı-sı (maktabning eshigi)\n- Ali'-nin araba-sı (Alining mashinasi)\n- ev-in oda-sı (uyning xonasi)`),
  block('a1-summary', 'A1 Umumiy Takrorlash', 3, `## A1 Yakuniy Integratsiya\n- Alifbo va talaffuz\n- Salomlashish va tanishuv\n- Ko'plik va ko'rsatish olmoshlari\n- Kelishiklar (-A, -DA, -DAn, -(y)I)\n- Hozirgi zamon (-yor) va istemek\n- Egalik va ot birikmalari`),
  block('practice-review', 'İsim tamlamaları va A1 amaliyoti', 4, 'Workbookdagi amaliy mashqlarni ketma-ket bajaring. Ochiq topshiriqlarda avtomatik tekshiruv uchun javob namunasi berilgan.', day12PracticeItems),
];
const day12Vocabulary = vocab([['kapı', 'eshik', 'Okulun kapısı.', 1], ['oda', 'xona', 'Evin odası.', 2], ['tamamlama', 'birikma, yakun', 'A1 tamamlandı.', 3]]);
const day12Questions: A1QuestionDefinition[] = [
  mc('“okulun kapısı” iborasi qanday birikma?', 'Belirtili isim tamlaması (aniq ot birikmasi).', 1, ['Sifat birikmasi', 'Aniq ot birikmasi', 'Fe’l birikmasi'], 1),
  tf('“A1 Entegrasyon” A1 darajasining barcha bilimlari takrorini o‘z ichiga oladi.', 'To‘g‘ri.', 2, true),
];

export const a1LessonDefinitions: A1LessonDefinition[] = [
  { day: 1, slug: 'a1-01-turk-alfabesi-va-tovushlar', title: '1-kun: Türk Alfabesi ve Sesler', summary: 'Turk alifbosi, maxsus harflar, talaffuz va katta unli uyg‘unligi asoslari.', durationMinutes: 45, contentBlocks: day1Blocks, vocabulary: day1Vocabulary, questions: day1Questions, masteryPassingPercentage: 75 },
  { day: 2, slug: 'a1-02-tanishuv-va-ozini-tanishtirish', title: '2-kun: Tanışma ve Kendini Tanıtma', summary: 'Salomlashish, ism, yosh, kasb, millat va hobbi haqida tanishtirish.', durationMinutes: 45, contentBlocks: day2Blocks, vocabulary: day2Vocabulary, questions: day2Questions, masteryPassingPercentage: 75 },
  { day: 3, slug: 'a1-03-koplik-ishorat-va-savol', title: '3-kun: Çoğul + İşaret + Soru', summary: '-lar/-ler, bu/şu/o, onlar va mı/mi/mu/mü.', durationMinutes: 50, contentBlocks: day3Blocks, vocabulary: day3Vocabulary, questions: day3Questions, masteryPassingPercentage: 75 },
  { day: 4, slug: 'a1-04-isim-halleri', title: '4-kun: İsim Halleri (-A, -DA, -DAn)', summary: 'Yo‘nalish, o‘rin-payt va chiqish kelishiklari, unli uyg‘unligi.', durationMinutes: 50, contentBlocks: day4Blocks, vocabulary: day4Vocabulary, questions: day4Questions, masteryPassingPercentage: 75 },
  { day: 5, slug: 'a1-05-zaman-ve-sinir', title: '5-kun: Zaman ve Sınır (-DAn ...A kadar)', summary: 'Vaqt oralig‘i, -DAn ...A kadar va -DAn önce / -DAn sonra qoidalari.', durationMinutes: 50, contentBlocks: day5Blocks, vocabulary: day5Vocabulary, questions: day5Questions, masteryPassingPercentage: 75 },
  { day: 6, slug: 'a1-06-oncelik-sonralik-sure', title: '6-kun: Öncelik-Sonralık-Süre (-mAdAn önce)', summary: '-mAdAn önce, -DIktAn sonra, -DAn beri va -DIr davomiylik shakllari.', durationMinutes: 55, contentBlocks: day6Blocks, vocabulary: day6Vocabulary, questions: day6Questions, masteryPassingPercentage: 75 },
  { day: 7, slug: 'a1-07-sayilar-ve-karsilastirma', title: '7-kun: Sayılar ve Karşılaştırma', summary: 'Sanoat va tartib sonlar, daha va en bilan solishtirish.', durationMinutes: 50, contentBlocks: day7Blocks, vocabulary: day7Vocabulary, questions: day7Questions, masteryPassingPercentage: 75 },
  { day: 8, slug: 'a1-08-zamirler-ve-iyelik', title: '8-kun: Zamirler ve İyelik', summary: 'Shaxs olmoshlari, ot-kesim shaxs qo‘shimchalari va egalik shakllari.', durationMinutes: 55, contentBlocks: day8Blocks, vocabulary: day8Vocabulary, questions: day8Questions, masteryPassingPercentage: 75 },
  { day: 9, slug: 'a1-09-belirli-nesne-ve-simdiki-zaman', title: '9-kun: Belirli Nesne + Şimdiki Zaman', summary: 'Tushum kelishigi -(y)I va -yor hozirgi davom zamoni.', durationMinutes: 55, contentBlocks: day9Blocks, vocabulary: day9Vocabulary, questions: day9Questions, masteryPassingPercentage: 75 },
  { day: 10, slug: 'a1-10-istemek-ve-yapim-ekleri', title: '10-kun: İstemek + Yapım Ekleri', summary: '-mak istemek shakli, -lI/-sIz, -ca/-ce va -ki yasovchi qo‘shimchalar.', durationMinutes: 50, contentBlocks: day10Blocks, vocabulary: day10Vocabulary, questions: day10Questions, masteryPassingPercentage: 75 },
  { day: 11, slug: 'a1-11-saatler', title: '11-kun: Saatler', summary: 'Vaqtni aytish (buçuk, çeyrek, geçiyor, var), gece/gündüz ifodalari.', durationMinutes: 50, contentBlocks: day11Blocks, vocabulary: day11Vocabulary, questions: day11Questions, masteryPassingPercentage: 75 },
  { day: 12, slug: 'a1-12-isim-tamlamalari-ve-a1-entegrasyon', title: '12-kun: İsim Tamlamaları + A1 Entegrasyon', summary: 'Belirtili isim tamlaması va A1 bosqichining umumiy integratsiyasi.', durationMinutes: 60, contentBlocks: day12Blocks, vocabulary: day12Vocabulary, questions: day12Questions, masteryPassingPercentage: 75 },
];

export const a1CourseDefinition = {
  title: 'Turk tili A1',
  slug: 'turk-tili-a1',
  shortDescription: 'Boshlang‘ich darajada turkcha o‘qish, muloqot va asosiy grammatikani o‘rganish kursi.',
  description: 'A1 kursining dastlabki uch darsi: talaffuz, tanishuv va sodda ko‘plik/ko‘rsatish/savol shakllari. Darslar Uzbek tilidagi izohlar, turkcha misollar, lug‘at va mashqlar bilan tuzilgan.',
  contentLanguage: 'tr',
  level: 'A1' as const,
  sortOrder: 1,
};

export const a1SectionDefinition = {
  title: 'A1 — 1–12-kunlar',
  description: 'A1 bosqichining birinchi uchta ishlab chiqilgan darsi.',
  position: 1,
};

export const A1_MASTERY_PASSING_PERCENTAGE = 75;
