import { Card } from '../primitives/Card';

export function PermissionDeniedState({ contained = false }: { contained?: boolean }) {
  const Element = contained ? 'section' : 'main';
  return (
    <Element
      className={contained ? 'mx-auto max-w-content' : 'mx-auto max-w-content px-4 py-12'}
      {...(!contained ? { id: 'main-content', tabIndex: -1 } : {})}
    >
      <Card className="border-warning-border bg-warning-bg" role="alert">
        <h1 className="type-heading-2 text-warning-text">Ruxsat mavjud emas</h1>
        <p className="mt-3 text-body-md text-warning-text">
          Bu hisobotni ko‘rish uchun rol yoki ruxsat yetarli emas.
        </p>
      </Card>
    </Element>
  );
}
