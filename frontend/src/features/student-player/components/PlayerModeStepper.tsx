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
    {
      mode: 'LEARN',
      stepNumber: 1,
      label: 'Nazariya',
      description: 'Dars materiali',
      isCompleted: true,
    },
    {
      mode: 'PRACTICE',
      stepNumber: 2,
      label: 'Amaliyot',
      description: 'Interaktiv mashqlar',
      isCompleted: practiceCompleted,
    },
    {
      mode: 'TEST',
      stepNumber: 3,
      label: 'Yakuniy test',
      description: 'Mustaqil imtihon',
      isCompleted: quizPassed,
    },
    {
      mode: 'RESULT',
      stepNumber: 4,
      label: 'Natija',
      description: 'O‘zlashtirish bali',
      isCompleted: quizPassed,
    },
  ];

  return (
    <nav aria-label="Dars bosqichlari" className="mb-8 border-b border-border-decorative/60 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        {steps.map((step) => {
          const isActive = currentMode === step.mode;
          const isResultStep = step.mode === 'RESULT';

          // Hide result tab if no quiz attempted yet unless active
          if (isResultStep && !hasAttemptedQuiz && !isActive) {
            return null;
          }

          return (
            <button
              key={step.mode}
              onClick={() => onSelectMode(step.mode)}
              type="button"
              className={`group flex items-center gap-2.5 rounded-lg px-3.5 py-2 text-left transition-all ${
                isActive
                  ? 'bg-action-primary-bg/10 text-action-primary-text font-semibold shadow-xs ring-1 ring-action-primary-bg/30'
                  : 'text-text-secondary hover:bg-subtle hover:text-text-primary'
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-caption font-bold transition-colors ${
                  isActive
                    ? 'bg-action-primary-bg text-white'
                    : step.isCompleted
                    ? 'bg-success-bg text-success-text border border-success-border'
                    : 'bg-subtle text-text-muted border border-border-control'
                }`}
              >
                {step.isCompleted && !isActive ? '✓' : step.stepNumber}
              </span>
              <div className="flex flex-col">
                <span className="text-label-md leading-tight">{step.label}</span>
                <span className="text-caption text-text-muted hidden sm:inline leading-tight">
                  {step.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
