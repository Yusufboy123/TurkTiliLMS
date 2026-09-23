export type LessonPlayerMode = 'LEARN' | 'PRACTICE' | 'TEST' | 'RESULT';

interface PlayerModeStepperProps {
  currentMode: LessonPlayerMode;
  onSelectMode: (mode: LessonPlayerMode) => void;
  hasAttemptedQuiz: boolean;
  practiceCompleted: boolean;
  quizPassed: boolean;
}

export function PlayerModeStepper({
  currentMode,
  onSelectMode,
  hasAttemptedQuiz,
  practiceCompleted,
  quizPassed,
}: PlayerModeStepperProps) {
  const steps: Array<{
    mode: LessonPlayerMode;
    stepNumber: number;
    label: string;
    description: string;
    isCompleted: boolean;
  }> = [
    { mode: 'LEARN', stepNumber: 1, label: 'Nazariya', description: 'Dars materiali', isCompleted: true },
    { mode: 'PRACTICE', stepNumber: 2, label: 'Amaliyot', description: 'Interaktiv mashqlar', isCompleted: practiceCompleted },
    { mode: 'TEST', stepNumber: 3, label: 'Yakuniy test', description: 'Mustaqil imtihon', isCompleted: quizPassed },
    { mode: 'RESULT', stepNumber: 4, label: 'Natija', description: 'O‘zlashtirish bali', isCompleted: quizPassed },
  ];
  const visibleSteps = steps.filter((step) => step.mode !== 'RESULT' || hasAttemptedQuiz || currentMode === 'RESULT');

  return (
    <nav aria-label="Dars bosqichlari" className="mb-8 border-b border-border-decorative/60 pb-4">
      <ol className="grid gap-1.5 sm:flex sm:items-stretch sm:gap-0">
        {visibleSteps.map((step, index) => {
          const isActive = currentMode === step.mode;
          const isLast = index === visibleSteps.length - 1;
          const isAvailable =
            step.mode === 'LEARN' ||
            step.mode === 'PRACTICE' ||
            (step.mode === 'TEST' && practiceCompleted) ||
            (step.mode === 'RESULT' && hasAttemptedQuiz);

          return (
            <li className="flex min-w-0 flex-col sm:flex-1 sm:flex-row sm:items-center" key={step.mode}>
              <button
                aria-current={isActive ? 'step' : undefined}
                aria-disabled={!isAvailable}
                className={`group relative flex min-h-target w-full min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:flex-1 ${
                  isActive
                    ? 'bg-nav-selected font-semibold text-nav-selected-text ring-1 ring-nav-indicator/30'
                    : step.isCompleted
                      ? 'border border-success-border bg-success-bg text-success-text hover:bg-success-bg/70'
                      : isAvailable
                        ? 'border border-border-control bg-subtle text-text-secondary hover:bg-nav-hover hover:text-text-primary'
                        : 'cursor-not-allowed border border-border-control bg-subtle text-text-muted opacity-60'
                }`}
                disabled={!isAvailable}
                onClick={() => {
                  if (isAvailable) onSelectMode(step.mode);
                }}
                type="button"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-caption font-bold ${
                    isActive
                      ? 'border-nav-indicator bg-nav-indicator text-text-inverse'
                      : step.isCompleted
                        ? 'border-success-border bg-surface text-success-text'
                        : 'border-border-control bg-surface text-text-muted'
                  }`}
                >
                  {step.isCompleted && !isActive ? '✓' : step.stepNumber}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-label-md leading-tight">{step.label}</span>
                  <span className="hidden truncate text-caption text-text-muted sm:inline leading-tight">{step.description}</span>
                </span>
              </button>
              {!isLast ? <span aria-hidden="true" className="ml-6 h-3 w-px bg-border-control sm:mx-2 sm:ml-0 sm:h-px sm:w-auto sm:flex-1" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
