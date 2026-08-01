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
    ISSUED: 'Sertifikat berilgan',
    REVOKED: 'Sertifikat bekor qilingan',
  },
  certificateNumber: 'Sertifikat raqami',
  download: 'Sertifikatni yuklab olish',
  downloading: 'Yuklab olinmoqda',
  downloadError: 'Sertifikatni yuklab bo\u2018lmadi. Qayta urinib ko\u2018ring.',
  completion: 'Kurs yakuni',
  lessons: 'ta dars yakunlandi',
  eligibleHint: 'Muvofiqlik tasdiqlangan. Sertifikat vakolatli administrator tomonidan beriladi.',
  incompleteHint: 'Barcha majburiy darslarni yakunlaganingizdan so\u2018ng muvofiqlik baholanadi.',
  notEligibleHint:
    'Muvofiqlik shartlari bajarilmagan. Sabablarni kurs mas\u2018uli bilan aniqlang.',
  issuedHint: 'Sertifikatingiz tayyor. Ruxsat berilgan bo\u2018lsa, uni yuklab olishingiz mumkin.',
  revokedHint: 'Bu sertifikat bekor qilingan va talaba tomonidan yuklab olinmaydi.',
} as const;
