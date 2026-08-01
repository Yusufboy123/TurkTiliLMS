import { Card, SkipLink } from '../../../components';
import { authMessages } from '../../../locales/uz-Latn/auth';
import { SessionActions } from '../components/SessionActions';

export default function TeacherHomePage() {
  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <SkipLink targetId="main-content" />
      <header className="border-b border-border-decorative bg-surface">
        <div className="mx-auto flex min-h-16 max-w-dashboard items-center px-4 md:px-6">
          <span className="type-heading-4">{authMessages.brand.name}</span>
        </div>
      </header>
      <main className="mx-auto max-w-dashboard px-4 py-8 md:px-6" id="main-content" tabIndex={-1}>
        <SessionActions className="mb-6" />
        <Card>
          <h1 className="type-heading-1">{authMessages.teacherHome.title}</h1>
          <p className="mt-3 max-w-reading text-body-md text-text-secondary">
            {authMessages.teacherHome.description}
          </p>
        </Card>
      </main>
    </div>
  );
}
