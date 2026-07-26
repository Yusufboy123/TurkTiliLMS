# Content, Microcopy, and Internationalization

**Status:** Review candidate

## Voice

The default interface language is Uzbek (Latin). Copy is respectful, direct,
calm, and useful. Prefer neutral imperatives without a pronoun. When direct
address is necessary, use formal **siz**; never mix it with informal **sen**.

- Explain what happened, its impact, and the next action.
- Use familiar product language, not backend enum, database, JWT, or permission
  terminology.
- Do not blame the user.
- Do not imply success before the server confirms it.
- Destructive copy is factual, not frightening.

## Canonical terminology

| Context                 | Required user-facing term |
| ----------------------- | ------------------------- |
| Student navigation      | `Jarayonim`               |
| Course-level label      | `Kurs jarayoni`           |
| Teacher/admin reporting | `O‘zlashtirish`           |
| Technical documentation | `Progress Tracking`       |
| Save current form       | `Saqlash`                 |
| Save edited record      | `O‘zgarishlarni saqlash`  |
| Cancel a UI action      | `Bekor qilish`            |
| Continue a sequence     | `Davom ettirish`          |
| Resume a course         | `Kursni davom ettirish`   |
| Complete a lesson/block | `Tugallash`               |
| Retry                   | `Qayta urinib ko‘rish`    |
| Delete                  | `O‘chirish`               |

Do not use “Progress” in Uzbek student navigation and do not use
“O‘zlashtirish” for the student’s personal navigation label.

### Status terms

| Technical state      | Uzbek Latin label        |
| -------------------- | ------------------------ |
| Active               | `Faol`                   |
| Suspended            | `Vaqtincha to‘xtatilgan` |
| Cancelled enrollment | `Kursdan chiqilgan`      |
| Locked lesson        | `Yopiq`                  |
| Draft                | `Qoralama`               |
| In review            | `Ko‘rib chiqilmoqda`     |
| Approved             | `Tasdiqlangan`           |
| Unpublished          | `Nashr qilinmagan`       |
| Published            | `Nashr qilingan`         |
| Archived             | `Arxivlangan`            |
| Not started          | `Boshlanmagan`           |
| In progress          | `Jarayonda`              |
| Pending sync         | `Tasdiqlanmoqda`         |
| Completed            | `Tugallangan`            |
| Unknown              | `Holat noma’lum`         |

Status-to-color selection is centralized in
[Foundations](./foundations.md); translation files contain labels, not color
choices.

## Uzbek Latin orthography

- Use Unicode curly apostrophe `’` consistently in product-authored text:
  `o‘rganish`, `bo‘lim`, `ma’lumot`.
- Turkish learning content uses `lang="tr"` and preserves `ç`, `ğ`, `ı`, `İ`,
  `ö`, `ş`, and `ü`.
- Russian content uses `lang="ru"` and Cyrillic-capable font files.
- User content is preserved; normalize only for safe search/indexing.
- Sentence case is the default for headings, labels, and buttons.

## Authentication copy

Use:

- `Kirish`
- `Elektron pochta`
- `Parol`
- `Parolni unutdingizmi?`
- `Shaxsni tasdiqlash`
- `Davom etish uchun shaxsingizni yana bir bor tasdiqlang.`
- `Seans muddati tugadi. Qayta kiring.`

Registration is not promised at launch. When the capability is disabled, do
not show a registration control. Invitation guidance explains that access is
provided by an administrator or invitation.

Authentication errors remain intentionally nonspecific:
`Elektron pochta yoki parol noto‘g‘ri.` They do not reveal whether an account,
role, permission, or credential exists.

## Error pattern

Structure:

1. concise problem;
2. user impact;
3. safe correction or retry;
4. optional safe reference ID.

Examples:

- `Ma’lumotlarni yuklab bo‘lmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.`
- `Kurs hozir faol emas. Jarayonni davom ettirish uchun administratorga murojaat qiling.`
- `O‘zgarishlar saqlanmadi. Kiritilgan ma’lumotlar saqlandi; qayta urinib ko‘ring.`

Never display raw stable error codes as the primary message. Never display a
stack trace, SQL, absolute path, token, or internal permission key.

## Destructive and security copy

A confirmation names the object and consequence:

- Title: `Foydalanuvchini o‘chirish`
- Body: `Bu amal foydalanuvchining tizimga kirishini to‘xtatadi. Tiklash mumkin bo‘lgan ma’lumotlar saqlanadi.`
- Safe action: `Bekor qilish`
- Danger action: `Foydalanuvchini o‘chirish`

Step-up text says identity confirmation is required; it never says which hidden
permission enabled the action. A failed step-up uses the same authentication
privacy rules as login.

## Progress language

- Use `3 ta darsdan 2 tasi tugallangan`, not a percentage alone.
- A local pending state says `Tasdiqlanmoqda…`.
- Only an authoritative response may say `Kurs jarayoni: 67%`.
- Suspended state explains that learning actions are paused without implying
  progress was deleted.
- Cancelled state explains read availability only if the future API contract
  permits it.
- Do not display streaks, achievement counts, or inferred watch positions in
  v1.

## Empty and success states

Empty state:

- heading naming the state;
- one sentence explaining why;
- one permitted next action;
- optional subtle illustration.

Routine success uses concise confirmation: `O‘zgarishlar saqlandi.` A course or
learning milestone may use restrained encouragement, but no fake score,
certificate, streak, or reward.

## Internationalization architecture

- All UI strings use semantic translation keys.
- API enums and error codes map through centralized dictionaries.
- Dates, numbers, percentages, durations, and file sizes use locale-aware
  formatters.
- Content language and interface language are independent.
- Translation keys do not encode layout or color.
- Inter font assets include Latin Extended and Cyrillic.
- Missing translation fails visibly in development and falls back safely in
  production with telemetry.

Initial locale order is Uzbek Latin (`uz-Latn`), Turkish (`tr`), English (`en`),
and Russian (`ru`). Flags never represent language choices.

## Expansion and layout

- Test at least 30% expansion plus known long fixtures in all four languages.
- Buttons may wrap to two lines.
- Primary headings and lesson titles never line-clamp.
- File names and identifiers use accessible middle truncation only when needed.
- Status badges may move to a new row; do not abbreviate status terms without an
  approved translation.
- Never reduce body text below the token scale to make a translation fit.

## Content ownership

Owner-editable homepage, banner, announcement, navigation, footer, contact, and
approved theme labels come from typed database-backed content. Security copy,
permission logic, validation rules, secret configuration, and destructive
safeguards remain in reviewed code. Admin editing does not allow HTML/script
outside an explicit sanitized rich-text contract.
