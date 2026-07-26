import { useEffect, useState } from 'react';
import { Badge, Button, Card, SkipLink } from '../components';
import { getApiHealth } from '../services/health.service';

type ApiStatus = 'checking' | 'online' | 'offline';

const learningSteps = [
  { number: '01', title: 'Tinglang', description: 'Tabiiy talaffuzni eshiting' },
  { number: '02', title: 'Mashq qiling', description: 'Bilimingizni mustahkamlang' },
  { number: '03', title: 'Gapiring', description: 'Ishonch bilan muloqot qiling' },
];

const statusPresentation = {
  checking: { intent: 'warning', label: 'API tekshirilmoqda' },
  online: { intent: 'success', label: 'API ishlayapti' },
  offline: { intent: 'neutral', label: 'API ishga tushirilmagan' },
} as const;

export function HomePage() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    let isMounted = true;

    getApiHealth()
      .then(() => {
        if (isMounted) setApiStatus('online');
      })
      .catch(() => {
        if (isMounted) setApiStatus('offline');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const status = statusPresentation[apiStatus];

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <SkipLink targetId="main-content" />

      <header className="border-b border-border-decorative bg-surface">
        <div className="mx-auto flex max-w-marketing items-center justify-between gap-4 px-4 py-4 md:px-6 lg:px-8">
          <a
            aria-label="Turk Tili LMS bosh sahifa"
            className="flex min-h-target items-center gap-3 rounded-md font-semibold text-text-primary no-underline visited:text-text-primary"
            href="/"
          >
            <span
              aria-hidden="true"
              className="grid h-11 w-11 place-items-center rounded-full bg-action-primary-bg text-action-primary-text"
            >
              T
            </span>
            <span>Turk Tili LMS</span>
          </a>
          <Badge intent={status.intent}>{status.label}</Badge>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="mx-auto grid max-w-marketing items-center gap-10 px-4 py-16 md:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <Badge intent="info">API-first til o‘rganish platformasi</Badge>
            <h1 className="type-display-sm mt-6 max-w-reading">
              Turk tilini zamonaviy usulda o‘rganing
            </h1>
            <p className="mt-6 max-w-reading text-body-lg text-text-secondary">
              Aniq yo‘l xaritasi, qulay mashqlar va har bir qurilmada davom etadigan yagona
              o‘rganish tajribasi.
            </p>
            <div className="mt-8 sm:w-fit">
              <Button
                onClick={() =>
                  document.getElementById('yondashuv')?.scrollIntoView({ block: 'start' })
                }
                width="full"
              >
                O‘rganishni boshlash
              </Button>
            </div>
          </div>

          <Card className="grid min-h-64 place-items-center bg-subtle" padding="lg">
            <div className="text-center">
              <span
                aria-hidden="true"
                className="mx-auto grid h-32 w-32 place-items-center rounded-full bg-action-primary-bg text-display-lg text-action-primary-text"
              >
                T
              </span>
              <p className="mt-6 text-label-md text-text-secondary">
                Tizimli, qulay va zamonaviy ta’lim
              </p>
            </div>
          </Card>
        </section>

        <section className="border-y border-border-decorative bg-surface" id="yondashuv">
          <div className="mx-auto grid max-w-marketing gap-4 px-4 py-12 md:grid-cols-3 md:px-6 lg:px-8">
            {learningSteps.map((step) => (
              <Card elevation="none" key={step.number}>
                <span className="text-label-sm text-icon-brand">{step.number}</span>
                <h2 className="type-heading-4 mt-3">{step.title}</h2>
                <p className="mt-2 text-body-sm text-text-secondary">{step.description}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-subtle px-4 py-6 text-center text-caption text-text-muted">
        Turk Tili LMS · Boshlang‘ich platforma arxitekturasi
      </footer>
    </div>
  );
}
