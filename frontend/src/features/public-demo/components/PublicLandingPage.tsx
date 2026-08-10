import { Link } from 'react-router-dom';
import { Card, SkipLink } from '../../../components';
import { publicDemoMessages as messages } from '../../../locales/uz-Latn/public-demo';
import { courseBenefits, faqs, learningLevels, learningSteps } from '../data/public-demo.data';
import { PublicHeader } from './PublicHeader';

const primaryLinkClass =
  'inline-flex min-h-12 items-center justify-center rounded-lg border border-action-primary-border bg-action-primary-bg px-6 py-3 text-button text-action-primary-text no-underline shadow-subtle transition-all hover:-translate-y-0.5 hover:bg-action-primary-hover-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

const secondaryLinkClass =
  'inline-flex min-h-12 items-center justify-center rounded-lg border border-action-secondary-border bg-action-secondary-bg px-6 py-3 text-button text-action-secondary-text no-underline transition-colors hover:bg-action-secondary-hover-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export function PublicLandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-canvas text-text-primary">
      <SkipLink targetId="main-content" />
      <PublicHeader />

      <main id="main-content" tabIndex={-1}>
        <section className="relative isolate overflow-hidden border-b border-border-decorative bg-surface">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-32 -z-10 h-80 w-80 rounded-full bg-action-primary-bg/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-40 left-1/3 -z-10 h-72 w-72 rounded-full bg-info-bg blur-3xl"
          />
          <div className="mx-auto grid max-w-marketing items-center gap-12 px-4 py-16 md:px-6 md:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-28">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-action-primary-bg/20 bg-nav-selected-bg px-3 py-1 text-label-sm text-nav-selected-text">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-action-primary-bg" />
                {messages.landing.eyebrow}
              </p>
              <h1 className="type-display-sm mt-6 max-w-reading text-balance text-text-primary">
                {messages.landing.headline}
              </h1>
              <p className="mt-6 max-w-reading text-body-lg text-text-secondary">
                {messages.landing.description}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link className={primaryLinkClass} to="/demo/turk-alfabesi">
                  {messages.landing.primaryCta}
                  <span aria-hidden="true" className="ml-2 text-lg">
                    →
                  </span>
                </Link>
                <Link className={secondaryLinkClass} to="/login">
                  {messages.landing.secondaryCta}
                </Link>
              </div>
              <p className="mt-5 text-body-sm text-text-muted">{messages.landing.heroNote}</p>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              <div
                className="absolute -inset-4 rounded-[2rem] bg-action-primary-bg/10 blur-2xl"
                aria-hidden="true"
              />
              <Card
                className="relative overflow-hidden border-action-primary-bg/20 bg-raised p-0 shadow-card"
                padding="none"
              >
                <div className="border-b border-border-decorative bg-subtle px-5 py-4">
                  <div className="flex items-center justify-between text-label-sm text-text-muted">
                    <span>Turk Tili LMS</span>
                    <span className="rounded-full bg-success-bg px-2 py-1 text-success-text">
                      A1 → C2
                    </span>
                  </div>
                </div>
                <div className="p-6 sm:p-8">
                  <div
                    className="grid grid-cols-3 gap-3"
                    aria-label="O‘rganish bosqichlari tasviri"
                  >
                    {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level, index) => (
                      <div
                        className={`rounded-xl border p-4 text-center ${index === 0 ? 'border-action-primary-bg bg-nav-selected-bg' : 'border-border-decorative bg-surface'}`}
                        key={level}
                      >
                        <span className="text-heading-4 font-bold">{level}</span>
                        <span className="mt-1 block text-caption text-text-muted">bosqich</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 rounded-xl bg-action-primary-bg p-5 text-action-primary-text">
                    <p className="text-label-sm uppercase tracking-[0.14em] text-action-primary-text/75">
                      Bepul boshlang
                    </p>
                    <p className="mt-2 text-heading-3 font-semibold">Türk Alfabesi</p>
                    <p className="mt-1 text-body-sm text-action-primary-text/80">
                      29 harf · A1 · interaktiv mashqlar
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section
          className="mx-auto max-w-marketing px-4 py-16 md:px-6 md:py-20 lg:px-8"
          id="darajalar"
        >
          <div className="max-w-reading">
            <p className="text-label-sm uppercase tracking-[0.16em] text-icon-brand">
              {messages.landing.levelsEyebrow}
            </p>
            <h2 className="type-heading-1 mt-3">{messages.landing.levelsTitle}</h2>
            <p className="mt-3 text-body-lg text-text-secondary">
              {messages.landing.levelsDescription}
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {learningLevels.map((level, index) => (
              <Card
                className="group transition-all hover:-translate-y-1 hover:border-action-primary-bg/40 hover:shadow-card"
                key={level.level}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="text-display-sm font-bold text-action-primary-bg">
                    {level.level}
                  </span>
                  <span className="rounded-full bg-subtle px-2 py-1 text-caption text-text-muted">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-heading-3">{level.label}</h3>
                <p className="mt-2 text-body-sm text-text-secondary">{level.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-y border-border-decorative bg-surface" id="yondashuv">
          <div className="mx-auto max-w-marketing px-4 py-16 md:px-6 md:py-20 lg:px-8">
            <div className="max-w-reading">
              <p className="text-label-sm uppercase tracking-[0.16em] text-icon-brand">
                {messages.landing.whyEyebrow}
              </p>
              <h2 className="type-heading-1 mt-3">{messages.landing.whyTitle}</h2>
              <p className="mt-3 text-body-lg text-text-secondary">
                {messages.landing.whyDescription}
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {courseBenefits.map((benefit) => (
                <Card className="bg-raised" elevation="subtle" key={benefit.title}>
                  <span
                    aria-hidden="true"
                    className="grid h-10 w-10 place-items-center rounded-lg bg-nav-selected-bg text-label-sm font-bold text-icon-brand"
                  >
                    {benefit.icon}
                  </span>
                  <h3 className="mt-5 text-heading-4">{benefit.title}</h3>
                  <p className="mt-2 text-body-sm text-text-secondary">{benefit.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section
          className="mx-auto max-w-marketing px-4 py-16 md:px-6 md:py-20 lg:px-8"
          id="bepul-dars"
        >
          <div className="grid items-center gap-8 rounded-3xl bg-action-primary-bg px-6 py-10 text-action-primary-text shadow-card md:px-10 lg:grid-cols-[1fr_auto] lg:py-12">
            <div>
              <p className="text-label-sm uppercase tracking-[0.16em] text-action-primary-text/75">
                {messages.landing.demoEyebrow}
              </p>
              <h2 className="mt-3 text-heading-1">{messages.landing.demoTitle}</h2>
              <p className="mt-3 max-w-reading text-body-lg text-action-primary-text/80">
                {messages.landing.demoDescription}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-label-md text-action-primary-text/85">
                <span className="rounded-full border border-action-primary-text/25 px-3 py-1">
                  A1
                </span>
                <span className="rounded-full border border-action-primary-text/25 px-3 py-1">
                  1-dars
                </span>
                <span className="rounded-full border border-action-primary-text/25 px-3 py-1">
                  Bepul
                </span>
              </div>
            </div>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-action-primary-text/30 bg-action-primary-text px-6 py-3 text-button text-action-primary-bg no-underline transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-primary-text"
              to="/demo/turk-alfabesi"
            >
              {messages.landing.demoCta}
              <span aria-hidden="true" className="ml-2 text-lg">
                →
              </span>
            </Link>
          </div>
        </section>

        <section className="border-y border-border-decorative bg-subtle">
          <div className="mx-auto max-w-marketing px-4 py-16 md:px-6 md:py-20 lg:px-8">
            <div className="max-w-reading">
              <p className="text-label-sm uppercase tracking-[0.16em] text-icon-brand">
                {messages.landing.stepsEyebrow}
              </p>
              <h2 className="type-heading-1 mt-3">{messages.landing.stepsTitle}</h2>
            </div>
            <ol className="mt-8 grid gap-4 md:grid-cols-5">
              {learningSteps.map((step) => (
                <li className="relative" key={step.number}>
                  <Card className="h-full bg-surface" padding="lg">
                    <span className="text-label-sm text-icon-brand">{step.number}</span>
                    <h3 className="mt-4 text-heading-4">{step.title}</h3>
                    <p className="mt-2 text-body-sm text-text-secondary">{step.description}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 md:px-6 md:py-20" id="savollar">
          <div className="text-center">
            <p className="text-label-sm uppercase tracking-[0.16em] text-icon-brand">
              {messages.landing.faqEyebrow}
            </p>
            <h2 className="type-heading-1 mt-3">{messages.landing.faqTitle}</h2>
          </div>
          <div className="mt-8 divide-y divide-border-decorative rounded-2xl border border-border-decorative bg-surface">
            {faqs.map((faq) => (
              <details
                className="group p-5 first:rounded-t-2xl last:rounded-b-2xl"
                key={faq.question}
              >
                <summary className="flex min-h-target cursor-pointer list-none items-center justify-between gap-4 rounded-md text-heading-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <span
                    aria-hidden="true"
                    className="text-2xl font-light text-icon-brand transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-reading pt-3 text-body-md text-text-secondary">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="border-t border-border-decorative bg-surface">
          <div className="mx-auto max-w-marketing px-4 py-16 text-center md:px-6 md:py-20 lg:px-8">
            <h2 className="type-heading-1">{messages.landing.finalTitle}</h2>
            <p className="mx-auto mt-4 max-w-reading text-body-lg text-text-secondary">
              {messages.landing.finalDescription}
            </p>
            <Link className={`${primaryLinkClass} mt-8`} to="/demo/turk-alfabesi">
              {messages.landing.finalCta}
              <span aria-hidden="true" className="ml-2 text-lg">
                →
              </span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border-decorative bg-subtle px-4 py-8 text-center text-caption text-text-muted">
        <p>Turk Tili LMS · Tizimli turk tili ta’limi</p>
      </footer>
    </div>
  );
}
