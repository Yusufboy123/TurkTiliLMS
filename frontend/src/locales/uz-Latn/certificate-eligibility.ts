export const certificateEligibilityMessages = {
  title: 'Kurs yakuni va sertifikat',
  loading: 'Sertifikatga muvofiqlik tekshirilmoqda…',
  retry: 'Qayta urinish',
  errors: {
    title: 'Ma\u2018lumotni olib bo\u2018lmadi',
    generic: 'Sertifikat holatini hozir ko\u2018rsatib bo\u2018lmadi.',
    permission: 'Bu ma\u2018lumotni ko\u2018rishga ruxsat yetarli emas.',
  },
  eligibility: {
    ELIGIBLE: 'Sertifikat olishga muvofiq',
    NOT_COMPLETED: 'Kurs hali yakunlanmagan',
    NOT_ELIGIBLE: 'Hozircha sertifikat olishga muvofiq emas',
  },
  certificate: {
    NOT_ISSUED: 'Sertifikat hali berilmagan',
  },
  completion: 'Kurs yakuni',
  lessons: 'ta dars yakunlandi',
  eligibleHint: 'Muvofiqlik tasdiqlangan. Sertifikat berish keyingi bosqichda yoqiladi.',
  incompleteHint: 'Barcha majburiy darslarni yakunlaganingizdan so\u2018ng muvofiqlik baholanadi.',
  notEligibleHint:
    'Muvofiqlik shartlari bajarilmagan. Sabablarni kurs mas\u2018uli bilan aniqlang.',
} as const;
