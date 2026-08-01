import { Spinner } from '../../../components';
import { authMessages } from '../../../locales/uz-Latn/auth';

export function AuthenticationBootstrap() {
  return (
    <main
      aria-label={authMessages.bootstrapping}
      className="grid min-h-screen place-items-center bg-canvas px-4 text-text-secondary"
      role="status"
    >
      <span className="flex items-center gap-3">
        <Spinner decorative delayMs={0} />
        {authMessages.bootstrapping}
      </span>
    </main>
  );
}
