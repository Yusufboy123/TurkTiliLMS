import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, SkipLink } from '../components';
import { authPaths } from '../features/auth';

const LEARNING_FLOW = [
  { step: 'Nazariya', icon: '📖', desc: 'Grammatika, qoidalar, jadvallar' },
  { step: 'Mashqlar', icon: '✏️', desc: 'Interaktiv topshiriqlar' },
  { step: 'Mavzu testi', icon: '📝', desc: 'Kamida 75% kerak' },
  { step: "Lug'at", icon: '🗂️', desc: "So'zlarni o'rganing" },
  { step: "Lug'at testi", icon: '🎯', desc: "Turkcha so'z yozing" },
  { step: 'Keyingi dars', icon: '▶', desc: "O'zlashtirish tasdiqlandi" },
];

const LEVELS = [
  { code: 'A1', title: "Boshlang'ich", lessons: 12, available: true },
  { code: 'A2', title: 'Quyi daraja', lessons: null, available: true },
  { code: 'B1', title: "O'rta daraja", lessons: null, available: false },
  { code: 'B2', title: "Yuqori o'rta", lessons: null, available: false },
];

const FEATURES = [
  {
    icon: '📚',
    title: 'Tizimli elektron darslik',
    desc: 'A1 dan B2 gacha ishlangan pedagogik matn, qoidalar va jadvallar',
  },
  {
    icon: '✏️',
    title: 'Interaktiv mashqlar',
    desc: "Blankni to'ldirish, tanlov, to'g'ri/noto'g'ri — darhol natija",
  },
  {
    icon: '🗂️',
    title: "Lug'at tizimi",
    desc: "Har darsda yangi so'zlar, holat (bilaman / qayta o'rganish)",
  },
  {
    icon: '🎯',
    title: "Yozma so'z eslatish",
    desc: "O'zbekcha ma'no ko'rib, Turkcha yozasiz — mashinani chalg'itmaydi",
  },
  {
    icon: '📊',
    title: "O'zlashtirish nazorati",
    desc: "75% — minimal daraja. Siz real natijani ko'rasiz",
  },
  {
    icon: '💬',
    title: "O'qituvchi bilan savol-javob",
    desc: "Dars ichida savol qo'yasiz, o'qituvchi javob beradi",
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <SkipLink targetId="main-content" />

      {/* ─── HEADER ─────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-40 border-b transition-all duration-200 ${
          scrolled
            ? 'border-border-decorative bg-surface/95 shadow-sm backdrop-blur-md'
            : 'border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-marketing items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
          <a
            aria-label="Turk Tili LMS bosh sahifa"
            className="flex items-center gap-2.5 font-bold text-text-primary no-underline visited:text-text-primary"
            href="/"
          >
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-action-primary-bg text-sm font-extrabold text-action-primary-text shadow-sm"
            >
              T
            </span>
            <span className="text-base tracking-tight">Turk Tili LMS</span>
          </a>
          <div className="flex items-center gap-2">
            <Link
              className="hidden rounded-lg px-4 py-2 text-sm font-medium text-text-secondary no-underline transition-colors hover:text-text-primary sm:inline-flex"
              to={authPaths.login}
            >
              Kirish
            </Link>
            <Button onClick={() => navigate(authPaths.register)} size="sm">
              Boshlash
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {/* ─── HERO ───────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-border-decorative bg-surface">
          {/* top accent line */}
          <div className="absolute inset-x-0 top-0 h-0.5 bg-action-primary-bg" aria-hidden="true" />

          <div className="mx-auto grid max-w-marketing items-center gap-12 px-4 py-20 md:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
            {/* Left: copy */}
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border-decorative bg-subtle px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-text">
                {"A1–B2 · O'zbek tilidagi platforma"}
              </span>
              <h1 className="type-display-sm mt-6 max-w-lg leading-tight">
                Turk tilini tizimli va amaliy o'rganing
              </h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-text-secondary">
                {"A1 dan boshlab nazariya, interaktiv mashqlar, lug'at va nazorat testlari orqali bosqichma-bosqich o'zlashtiring."}
              </p>
              <p className="mt-4 flex items-center gap-2 text-sm font-medium text-text-muted">
                <span className="inline-block h-2 w-2 rounded-full bg-action-primary-bg" aria-hidden="true" />
                {"Har bir dars uchun minimal 75% o'zlashtirish talab etiladi"}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button onClick={() => navigate(authPaths.register)} size="lg">
                  Boshlash
                </Button>
                <Button
                  intent="secondary"
                  onClick={() => navigate('/demo/turk-alfabesi')}
                  size="lg"
                >
                  Namuna darsni ko'rish
                </Button>
              </div>
            </div>

            {/* Right: learning flow visual */}
            <div className="rounded-2xl border border-border-decorative bg-canvas p-6 shadow-md">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
                {"O'rganish yo'li — har bir dars"}
              </p>
              <ol className="space-y-2">
                {LEARNING_FLOW.map((item, i) => (
                  <li
                    key={item.step}
                    className="flex items-center gap-3 rounded-lg border border-border-decorative bg-surface px-4 py-3 shadow-sm"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle text-sm font-bold text-text-muted tabular-nums"
                    >
                      {i + 1}
                    </span>
                    <span className="text-base" aria-hidden="true">{item.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary">{item.step}</p>
                      <p className="text-xs text-text-muted">{item.desc}</p>
                    </div>
                    {item.step === 'Mavzu testi' && (
                      <span className="shrink-0 rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning-text">
                        75%+
                      </span>
                    )}
                    {item.step === 'Keyingi dars' && (
                      <span className="shrink-0 rounded-full bg-success-bg px-2 py-0.5 text-xs font-semibold text-success-text">
                        ✓
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ─── LEVEL JOURNEY ──────────────────────────────────────── */}
        <section className="border-b border-border-decorative bg-subtle" aria-labelledby="levels-heading">
          <div className="mx-auto max-w-marketing px-4 py-16 md:px-6 lg:px-8">
            <h2 className="type-heading-2 text-center" id="levels-heading">
              {"O'rganish darajalari"}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-center text-base text-text-secondary">
              {"Boshlang'ichdan ilg'orgacha izchil o'sish"}
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {LEVELS.map((lvl) => (
                <div
                  key={lvl.code}
                  className={`relative rounded-xl border p-6 ${
                    lvl.available
                      ? 'border-action-primary-border bg-surface shadow-sm'
                      : 'border-border-decorative bg-surface opacity-50'
                  }`}
                >
                  {lvl.available && (
                    <span className="absolute right-3 top-3 rounded-full bg-success-bg px-2 py-0.5 text-xs font-bold text-success-text">
                      Mavjud
                    </span>
                  )}
                  <p className="text-3xl font-extrabold tracking-tight text-action-primary-bg">
                    {lvl.code}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{lvl.title}</p>
                  {lvl.lessons ? (
                    <p className="mt-2 text-xs text-text-muted">{lvl.lessons} ta dars</p>
                  ) : (
                    <p className="mt-2 text-xs text-text-muted">Tez orada</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FEATURES ───────────────────────────────────────────── */}
        <section className="border-b border-border-decorative bg-surface" aria-labelledby="features-heading">
          <div className="mx-auto max-w-marketing px-4 py-16 md:px-6 lg:px-8">
            <h2 className="type-heading-2 text-center" id="features-heading">
              Platforma imkoniyatlari
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-base text-text-secondary">
              {"Bir yerda — nazariya, mashqlar, lug'at, nazorat va muloqot"}
            </p>
            <dl className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-border-decorative bg-subtle p-5 transition-shadow hover:shadow-sm"
                >
                  <span className="text-2xl" aria-hidden="true">{f.icon}</span>
                  <dt className="mt-3 text-base font-semibold text-text-primary">{f.title}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-text-secondary">{f.desc}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ─── FINAL CTA ──────────────────────────────────────────── */}
        <section className="bg-surface" aria-labelledby="cta-heading">
          <div className="mx-auto max-w-marketing px-4 py-20 text-center md:px-6 lg:px-8">
            <h2 className="type-heading-1" id="cta-heading">
              Birinchi darsni bepul boshlang
            </h2>
            <p className="mx-auto mt-4 max-w-sm text-base text-text-secondary">
              {'A1 daraja — 12 dars. Turk alifbosidan salomlashishgacha.'}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button onClick={() => navigate(authPaths.register)} size="lg">
                {"Ro'yxatdan o'tish"}
              </Button>
              <Button intent="secondary" onClick={() => navigate(authPaths.login)} size="lg">
                Hisobga kirish
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─────────────────────────────────────────────── */}
      <footer className="border-t border-border-decorative bg-subtle">
        <div className="mx-auto flex max-w-marketing flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-text-muted md:px-6 lg:px-8">
          <p className="font-semibold text-text-secondary">Turk Tili LMS</p>
          <p>{"O'zbek tilidagi professional Turk tili platformasi"}</p>
        </div>
      </footer>
    </div>
  );
}
