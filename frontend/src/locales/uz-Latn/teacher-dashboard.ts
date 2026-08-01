export const teacherDashboardMessages = {
  navigation: 'O‘qituvchi paneli',
  eyebrow: 'O‘qituvchi ish maydoni',
  title: 'O‘qituvchi boshqaruv paneli',
  description:
    'Biriktirilgan kurslar, talabalar faolligi va o‘zlashtirish ko‘rsatkichlarini kuzating.',
  assignedCourses: 'Biriktirilgan kurslar',
  assignedCount: (count: number) => `Jami ${count} ta kurs biriktirilgan`,
  level: 'Daraja',
  averageProgress: 'O‘rtacha o‘zlashtirish',
  averageProgressFor: (courseTitle: string) => `${courseTitle}: o‘rtacha o‘zlashtirish`,
  openReport: 'Kurs hisobotini ochish',
  retry: 'Qayta urinish',
  loading: 'O‘qituvchi paneli yuklanmoqda',
  courseSummaryLoading: 'Kurs o‘zlashtirish xulosasi yuklanmoqda',
  courseSummaryError: 'Kurs o‘zlashtirish xulosasini yuklab bo‘lmadi.',
  paginationLabel: 'Biriktirilgan kurslar sahifalari',
  students: {
    total: 'Jami yozilishlar',
    active: 'Faol',
    completed: 'Yakunlagan',
  },
  empty: {
    title: 'Biriktirilgan kurslar yo‘q',
    body: 'Sizga hali kurs biriktirilmagan. Kurs biriktirish uchun administratorga murojaat qiling.',
  },
  status: {
    DRAFT: 'Qoralama',
    IN_REVIEW: 'Ko‘rib chiqilmoqda',
    PUBLISHED: 'Nashr qilingan',
    ARCHIVED: 'Arxivlangan',
  },
} as const;
