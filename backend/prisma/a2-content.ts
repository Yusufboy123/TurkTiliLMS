import { a2V2PracticeByDay } from './a2-v2-practice.generated.js';
import { a2V2QuestionsByDay } from './a2-v2-questions.generated.js';
import { a2V2TheoryByDay } from './a2-v2-theory.generated.js';

export type A2QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MISSING_WORD';

export interface A2ContentBlockDefinition {
  key: string;
  title: string;
  blockType: 'TEXT';
  position: number;
  textContent?: string;
  isRequired?: boolean;
  practiceItems?: A2PracticeItemDefinition[];
}

export type A2PracticeItemType =
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'MISSING_WORD'
  | 'CLASSIFY';

export interface A2PracticeItemDefinition {
  id: string;
  type: A2PracticeItemType;
  prompt: string;
  options?: string[];
  answer: string;
  explanation: string;
  stage: number;
}

export interface A2QuestionOptionDefinition {
  text: string;
  isCorrect: boolean;
  position: number;
}

export interface A2QuestionDefinition {
  type: A2QuestionType;
  prompt: string;
  explanation: string;
  points: number;
  position: number;
  options: A2QuestionOptionDefinition[];
}

export interface A2LessonDefinition {
  day: number;
  slug: string;
  title: string;
  summary: string;
  durationMinutes: number;
  contentBlocks: A2ContentBlockDefinition[];
  questions: A2QuestionDefinition[];
  masteryPassingPercentage: number;
}

export const A2_MASTERY_PASSING_PERCENTAGE = 75;

const lessonTitles = [
  '1-DARS. Belirli Geçmiş Zaman (-DI) ve Geçmiş Deneyimler',
  '2-DARS. Öğrenilen Geçmiş Zaman (-mIş): Duyum ve Çıkarım',
  '3-DARS. Gelecek Zaman (-AcAk): Planlar, Davetler ve Tahminler',
  '4-DARS. Geniş Zaman: Alışkanlıklar, Tercihler ve Genel Gerçekler',
  '5-DARS. Zamanları Karşılaştırma ve Olayları Sıralama',
  '6-DARS. Yeterlik ve Olasılık (-Abil): Beceri, İzin ve Rica',
  '7-DARS. Gereklilik, Zorunluluk ve Tavsiye',
  '8-DARS. Karşılaştırma, Sıfatlar ve Zarflar',
  '9-DARS. Cümle Bağlama: Neden, Sonuç ve Amaç',
  '10-DARS. Eğitim, İş Hayatı ve Basit Görüş Bildirme',
  '11-DARS. Alışveriş ve Yemek: Rica, Tercih ve Sorun Çözme',
  '12-DARS. Sağlık ve Randevular: Belirti, Tavsiye ve Geçmiş',
  '13-DARS. Seyahat, Ulaşım, Yol Tarifi ve Hava Durumu',
  '14-DARS. Sosyal Hayat, Planlar ve A2 Entegrasyon',
] as const;

export const a2LessonDefinitions: A2LessonDefinition[] = lessonTitles.map((title, index) => {
  const day = index + 1;
  const theory = a2V2TheoryByDay[day];
  const practiceItems = a2V2PracticeByDay[day];
  const questions = a2V2QuestionsByDay[day];

  if (!theory || !practiceItems || !questions) {
    throw new Error(`A2 V2 source package is incomplete for lesson ${day}.`);
  }

  return {
    day,
    slug: `a2-${String(day).padStart(2, '0')}`,
    title,
    summary: `${title} mavzusining to‘liq nazariyasi, interaktiv amaliyoti va yakuniy testi.`,
    durationMinutes: 60,
    contentBlocks: [
      {
        key: 'a2-v2-theory',
        title: `${title} — elektron dars`,
        blockType: 'TEXT',
        position: 1,
        textContent: theory,
        isRequired: false,
      },
      {
        key: 'a2-v2-practice',
        title: 'Interaktiv mashqlar',
        blockType: 'TEXT',
        position: 2,
        textContent:
          'Nazariyani o‘rganganingizdan keyin mashqlarni ketma-ket bajaring. Har bir javob darhol tekshiriladi.',
        isRequired: true,
        practiceItems,
      },
    ],
    questions,
    masteryPassingPercentage: A2_MASTERY_PASSING_PERCENTAGE,
  };
});

export const a2CourseDefinition = {
  slug: 'turk-tili-a2',
  title: 'Turk tili A2',
  shortDescription: 'A2 darajasida zamonlar, imkon, zaruriyat, qiyos, bog‘lovchilar va kundalik muloqot.',
  description:
    'A2 kursi 14 ta to‘liq nazariya darsi, interaktiv amaliy mashqlar va yakuniy testlardan iborat.',
  contentLanguage: 'uz-Latn',
  level: 'A2' as const,
};

export const a2SectionDefinition = {
  position: 1,
  title: 'A2 darslari',
  description: 'A2 bosqichining 14 ta izchil darsi.',
};
