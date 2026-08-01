export const authMessages = {
  brand: {
    name: 'Turk Tili LMS',
    homeLabel: 'Turk Tili LMS bosh sahifa',
  },
  bootstrapping: 'Sessiya tekshirilmoqda',
  login: {
    title: 'Tizimga kirish',
    description: 'O‘qishni davom ettirish uchun hisobingizga kiring.',
    email: 'Elektron pochta',
    password: 'Parol',
    submit: 'Kirish',
    showPassword: 'Parolni ko‘rsatish',
    hidePassword: 'Parolni yashirish',
    capsLock: 'Caps Lock yoqilgan.',
    recovery: 'Parolni unutdingizmi? Platforma administratoriga murojaat qiling.',
    accountProvisioning: 'Hisoblar platforma administratori tomonidan yaratiladi.',
  },
  validation: {
    emailRequired: 'Elektron pochta manzilini kiriting.',
    emailInvalid: 'Elektron pochta manzilini to‘g‘ri formatda kiriting.',
    passwordRequired: 'Parolni kiriting.',
    passwordTooLong: 'Parol 128 ta belgidan oshmasligi kerak.',
    summary: 'Quyidagi ma’lumotlarni tekshiring:',
  },
  errors: {
    invalidCredentials: 'Elektron pochta yoki parol noto‘g‘ri.',
    inactiveAccountHelp:
      'Hisobingiz to‘xtatilgan bo‘lishi mumkin. Zarur bo‘lsa administratorga murojaat qiling.',
    validation: 'Kiritilgan ma’lumotlarni tekshirib, qayta urinib ko‘ring.',
    rateLimited: 'Juda ko‘p urinish bo‘ldi. Biroz kutib, qayta urinib ko‘ring.',
    network: 'Tarmoqqa ulanib bo‘lmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.',
    server: 'Xizmat vaqtincha ishlamayapti. Birozdan so‘ng qayta urinib ko‘ring.',
    unknown: 'Tizimga kirishda xatolik yuz berdi. Qayta urinib ko‘ring.',
  },
  session: {
    expired: 'Seans muddati tugadi. Qayta kiring.',
    signedOut: 'Tizimdan muvaffaqiyatli chiqdingiz.',
    actions: 'Sessiya amallari',
    logout: 'Chiqish',
    logoutAll: 'Barcha qurilmalardan chiqish',
  },
  teacherHome: {
    title: 'O‘qituvchi bosh sahifasi',
    description:
      'Bu autentifikatsiyadan keyingi boshlang‘ich sahifa. Kurs jarayoni hisobotini ko‘rish uchun tegishli kurs sahifasini oching.',
  },
} as const;
