import { useEffect, useState } from 'react';
import { getApiHealth } from '../services/health.service';

type ApiStatus = 'checking' | 'online' | 'offline';

const learningSteps = [
  { number: '01', title: 'Tinglang', description: 'Tabiiy talaffuzni eshiting' },
  { number: '02', title: 'Mashq qiling', description: 'Bilimingizni mustahkamlang' },
  { number: '03', title: 'Gapiring', description: 'Ishonch bilan muloqot qiling' },
];

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

  const statusLabel = {
    checking: 'API tekshirilmoqda',
    online: 'API ishlayapti',
    offline: 'API ishga tushirilmagan',
  }[apiStatus];

  return (
    <div className="min-h-screen overflow-hidden bg-[#fffafa] text-brand-950">
      <div className="pointer-events-none fixed inset-0 opacity-[0.035] noise-texture" />

      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
        <a
          href="/"
          className="group flex items-center gap-3"
          aria-label="Turk Tili LMS bosh sahifa"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-600 text-lg font-black text-white shadow-lg shadow-red-900/15 transition-transform group-hover:-rotate-6">
            T
          </span>
          <span className="text-base font-extrabold tracking-[-0.02em] sm:text-lg">
            Turk Tili <span className="text-brand-600">LMS</span>
          </span>
        </a>

        <div className="flex items-center gap-2 rounded-full border border-red-100 bg-white/80 px-3 py-2 text-xs font-semibold text-brand-950 shadow-sm backdrop-blur sm:px-4">
          <span
            className={`h-2 w-2 rounded-full ${
              apiStatus === 'online'
                ? 'bg-emerald-500'
                : apiStatus === 'checking'
                  ? 'animate-pulse bg-amber-400'
                  : 'bg-slate-300'
            }`}
          />
          <span className="hidden sm:inline">{statusLabel}</span>
          <span className="sm:hidden">v0.1</span>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid min-h-[calc(100vh-96px)] w-full max-w-7xl items-center gap-12 px-5 pb-14 pt-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-12 lg:pb-20 lg:pt-6">
          <div className="relative z-10 max-w-3xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-600 shadow-sm">
              <span className="h-px w-5 bg-brand-500" />
              Yangi avlod til platformasi
            </div>

            <h1 className="max-w-3xl text-[clamp(3.4rem,9vw,7.4rem)] font-black leading-[0.86] tracking-[-0.07em] text-brand-950">
              Turk tilini
              <span className="relative mt-3 block text-brand-600">
                zamonaviy
                <span className="absolute -right-3 top-1 hidden rotate-12 text-2xl font-medium tracking-normal text-brand-500 lg:block">
                  ✦
                </span>
              </span>
              usulda o‘rganing
            </h1>

            <p className="mt-8 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              Aniq yo‘l xaritasi, qulay mashqlar va har bir qurilmada davom etadigan yagona
              o‘rganish tajribasi.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <a
                href="#yondashuv"
                className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-brand-600 px-7 text-sm font-bold text-white shadow-[0_16px_35px_-14px_rgba(200,29,37,0.75)] transition hover:-translate-y-0.5 hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-red-200"
              >
                O‘rganishni boshlash
                <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">
                  →
                </span>
              </a>
              <p className="text-sm font-medium text-slate-500">
                <span className="font-extrabold text-brand-950">API-first</span> arxitektura
              </p>
            </div>
          </div>

          <div className="relative mx-auto flex w-full max-w-lg items-center justify-center py-8 lg:py-0">
            <div className="absolute h-[28rem] w-[28rem] rounded-full border border-red-100 bg-white shadow-soft sm:h-[34rem] sm:w-[34rem]" />
            <div className="absolute h-[22rem] w-[22rem] rounded-full border border-dashed border-brand-500/30 sm:h-[27rem] sm:w-[27rem]" />
            <div className="relative grid h-[17rem] w-[17rem] place-items-center rounded-full bg-brand-600 text-white shadow-[0_30px_80px_-25px_rgba(128,15,22,0.8)] sm:h-[21rem] sm:w-[21rem]">
              <div className="text-center">
                <span className="block text-[7rem] font-black leading-none tracking-[-0.08em] sm:text-[9rem]">
                  T
                </span>
                <span className="mt-2 block text-xs font-bold uppercase tracking-[0.42em] text-red-100">
                  Türkçe
                </span>
              </div>
            </div>
            <div className="absolute left-0 top-8 rounded-2xl border border-red-100 bg-white px-4 py-3 shadow-lg sm:left-2 sm:top-5">
              <span className="block text-xs text-slate-400">Bugungi so‘z</span>
              <span className="mt-1 block font-extrabold text-brand-950">Merhaba!</span>
            </div>
            <div className="absolute bottom-5 right-0 rounded-2xl bg-brand-950 px-4 py-3 text-white shadow-lg sm:bottom-8">
              <span className="block text-xs text-red-200">Maqsad</span>
              <span className="mt-1 block font-extrabold">Har kuni 15 daqiqa</span>
            </div>
          </div>
        </section>

        <section id="yondashuv" className="relative border-y border-red-100 bg-white">
          <div className="mx-auto grid w-full max-w-7xl gap-0 px-5 py-6 sm:px-8 md:grid-cols-3 lg:px-12">
            {learningSteps.map((step, index) => (
              <article
                key={step.number}
                className={`flex gap-4 py-5 md:px-7 ${
                  index > 0 ? 'border-t border-red-100 md:border-l md:border-t-0' : ''
                }`}
              >
                <span className="text-xs font-black tracking-[0.18em] text-brand-500">
                  {step.number}
                </span>
                <div>
                  <h2 className="font-extrabold text-brand-950">{step.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{step.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-brand-950 px-5 py-5 text-center text-xs text-red-100/70">
        Turk Tili LMS · Boshlang‘ich platforma arxitekturasi
      </footer>
    </div>
  );
}
