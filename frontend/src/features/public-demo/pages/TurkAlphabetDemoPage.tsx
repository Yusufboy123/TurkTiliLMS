import { Link } from 'react-router-dom';
import { Card, SkipLink } from '../../../components';
import { publicDemoMessages as messages } from '../../../locales/uz-Latn/public-demo';
import { alphabetLetters, specialLetters } from '../data/public-demo.data';
import { FinalAssessment } from '../components/FinalAssessment';
import { PracticeSection } from '../components/PracticeSection';
import { PublicHeader } from '../components/PublicHeader';

const writtenExamples = [
  { letter: 'Ç ç', word: 'çay', meaning: 'choy' },
  { letter: 'Ş ş', word: 'şeker', meaning: 'shakar' },
  { letter: 'Ö ö', word: 'öğretmen', meaning: 'o‘qituvchi' },
  { letter: 'Ü ü', word: 'Türkiye / üzüm', meaning: 'Turkiya / uzum' },
  { letter: 'I ı', word: 'kız', meaning: 'qiz' },
  { letter: 'İ i', word: 'iki', meaning: 'ikki' },
  { letter: 'Ğ ğ', word: 'dağ', meaning: 'tog‘' },
] as const;

export default function TurkAlphabetDemoPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-canvas text-text-primary">
      <SkipLink targetId="main-content" />
      <PublicHeader compact />
      <main id="main-content" tabIndex={-1}>
        <section className="border-b border-border-decorative bg-surface">
          <div className="mx-auto max-w-marketing px-4 py-10 md:px-6 md:py-16 lg:px-8">
            <Link
              className="inline-flex min-h-target items-center rounded-md text-body-sm text-text-secondary no-underline hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
              to="/"
            >
              <span aria-hidden="true" className="mr-2">
                ←
              </span>
              {messages.demo.back}
            </Link>
            <div className="mt-8 max-w-reading">
              <div className="flex flex-wrap gap-2 text-label-sm">
                <span className="rounded-full bg-nav-selected-bg px-3 py-1 text-nav-selected-text">
                  A1
                </span>
                <span className="rounded-full bg-success-bg px-3 py-1 text-success-text">
                  1-dars
                </span>
                <span className="rounded-full bg-info-bg px-3 py-1 text-info-text">Bepul</span>
              </div>
              <h1 className="type-display-sm mt-5">{messages.demo.title}</h1>
              <p className="mt-5 text-body-lg text-text-secondary">{messages.demo.intro}</p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="video-title"
          className="mx-auto max-w-marketing px-4 py-10 md:px-6 md:py-14 lg:px-8"
        >
          <div className="mx-auto max-w-4xl">
            <div className="aspect-video overflow-hidden rounded-2xl border border-border-decorative bg-text-primary shadow-card">
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full"
                referrerPolicy="strict-origin-when-cross-origin"
                src="https://www.youtube-nocookie.com/embed/I0XRfWR51d4?rel=0&modestbranding=1"
                title={messages.demo.videoLabel}
              />
            </div>
            <p className="mt-3 text-caption text-text-muted">
              Video dars qo‘shimcha tushuntirish beradi; quyidagi yozma dars uning so‘zma-so‘z
              transkripti emas.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="lesson-title"
          className="border-y border-border-decorative bg-surface"
        >
          <div className="mx-auto max-w-marketing px-4 py-16 md:px-6 md:py-20 lg:px-8">
            <div className="max-w-reading">
              <p className="text-label-sm uppercase tracking-[0.16em] text-icon-brand">
                {messages.demo.lessonEyebrow}
              </p>
              <h2 className="type-heading-1 mt-3" id="lesson-title">
                {messages.demo.lessonTitle}
              </h2>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <article className="space-y-6">
                <Card className="border-action-primary-bg/20 bg-nav-selected-bg" padding="lg">
                  <p className="text-label-sm uppercase tracking-[0.14em] text-icon-brand">Muhim</p>
                  <p className="mt-3 text-body-lg text-text-primary">
                    Turk alifbosida 29 ta harf bor. Har bir harfning katta va kichik shakli mavjud.
                    Alifboda unlilar va undoshlar birga ishlatiladi.
                  </p>
                </Card>

                <div>
                  <h3 className="text-heading-2">To‘liq turk alifbosi</h3>
                  <p className="mt-3 max-w-reading text-body-md text-text-secondary">
                    Quyidagi jadvalda katta va kichik harflarni birga ko‘ring. Qizil rangdagi
                    kataklar turk tiliga xos harflarni bildiradi.
                  </p>
                  <div
                    className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7"
                    aria-label="Turk alifbosi 29 harfi"
                  >
                    {alphabetLetters.map((letter) => (
                      <div
                        className={`rounded-xl border p-3 text-center ${letter.special ? 'border-action-primary-bg/30 bg-nav-selected-bg' : 'border-border-decorative bg-subtle'}`}
                        key={letter.uppercase}
                      >
                        <p className="text-heading-3 font-semibold">{letter.uppercase}</p>
                        <p className="mt-1 text-body-sm text-text-secondary">{letter.lowercase}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Card className="bg-subtle" padding="lg">
                  <p className="text-label-sm uppercase tracking-[0.14em] text-icon-brand">
                    Eslab qoling
                  </p>
                  <p className="mt-3 text-body-md text-text-primary">
                    Turk alifbosida odatda Q, W va X harflari ishlatilmaydi. Ularni inglizcha yoki
                    boshqa tillardagi yozuvlardan farqlang.
                  </p>
                </Card>
              </article>

              <aside className="space-y-6">
                <Card padding="lg">
                  <h3 className="text-heading-3">Unli va undoshlar</h3>
                  <dl className="mt-5 space-y-4 text-body-sm">
                    <div>
                      <dt className="font-semibold text-text-primary">Unlilar</dt>
                      <dd className="mt-1 text-text-secondary">a, e, ı, i, o, ö, u, ü</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-text-primary">Undoshlar</dt>
                      <dd className="mt-1 text-text-secondary">
                        Qolgan harflar: b, c, ç, d, f, g, ğ, h, j, k, l, m, n, p, r, s, ş, t, v, y,
                        z.
                      </dd>
                    </div>
                  </dl>
                </Card>
                <Card className="border-action-primary-bg/20 bg-nav-selected-bg" padding="lg">
                  <h3 className="text-heading-3">I, İ, ı, i farqi</h3>
                  <p className="mt-3 text-body-sm text-text-secondary">
                    Nuqtali va nuqtasiz harflar turk tilida alohida harf hisoblanadi.
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-2 text-center">
                    {['I', 'İ', 'ı', 'i'].map((letter) => (
                      <span className="rounded-lg bg-surface px-3 py-3 text-heading-3" key={letter}>
                        {letter}
                      </span>
                    ))}
                  </div>
                </Card>
                <Card padding="lg">
                  <h3 className="text-heading-3">Talaffuzga yaqin eslatmalar</h3>
                  <p className="mt-3 text-body-sm text-text-secondary">
                    Bu taqqoslashlar boshlang‘ich yo‘nalish uchun. Aniq talaffuzni video va
                    o‘qituvchi yordami bilan eshitib mashq qiling.
                  </p>
                  <ul className="mt-5 space-y-3 text-body-sm text-text-secondary">
                    <li>
                      <strong className="text-text-primary">Ç ç</strong> — “ch” ga yaqin.
                    </li>
                    <li>
                      <strong className="text-text-primary">Ş ş</strong> — “sh” ga yaqin.
                    </li>
                    <li>
                      <strong className="text-text-primary">Ö ö</strong> va{' '}
                      <strong className="text-text-primary">Ü ü</strong> — labni yumaloqlab
                      aytiladigan unlilar.
                    </li>
                    <li>
                      <strong className="text-text-primary">Ğ ğ</strong> — ko‘pincha oldingi
                      unlining cho‘zilishiga yordam beradi.
                    </li>
                    <li>
                      <strong className="text-text-primary">I ı</strong> nuqtasiz,{' '}
                      <strong className="text-text-primary">İ i</strong> esa nuqtali alohida
                      harfdir.
                    </li>
                  </ul>
                </Card>
              </aside>
            </div>

            <div className="mt-12">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-label-sm uppercase tracking-[0.14em] text-icon-brand">
                    Misollar
                  </p>
                  <h3 className="mt-2 text-heading-2">Maxsus harflarni so‘zlarda ko‘ring</h3>
                </div>
                <p className="text-body-sm text-text-muted">
                  Talaffuzni audio va o‘qituvchi yordami bilan yanada chuqurroq o‘rganasiz.
                </p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {specialLetters.map((letter) => {
                  const example = writtenExamples.find(({ letter: pair }) =>
                    pair.startsWith(letter.uppercase),
                  );
                  return (
                    <Card className="bg-raised" key={letter.uppercase}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-heading-2 text-action-primary-bg">
                          {letter.uppercase} {letter.lowercase}
                        </span>
                        <span className="text-caption text-text-muted">maxsus</span>
                      </div>
                      <p className="mt-4 text-heading-4">{example?.word}</p>
                      <p className="mt-1 text-body-sm text-text-secondary">{example?.meaning}</p>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <PracticeSection />
        <FinalAssessment />
      </main>

      <footer className="border-t border-border-decorative bg-subtle px-4 py-8 text-center text-caption text-text-muted">
        <Link
          className="rounded-md text-text-secondary no-underline hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          to="/"
        >
          {messages.demo.back}
        </Link>
      </footer>
    </div>
  );
}
