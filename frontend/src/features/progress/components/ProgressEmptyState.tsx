import { Card } from '../../../components';

interface ProgressEmptyStateProps {
  body: string;
  headingLevel?: 'h2' | 'h3';
  title: string;
}

export function ProgressEmptyState({
  body,
  headingLevel: Heading = 'h2',
  title,
}: ProgressEmptyStateProps) {
  return (
    <Card className="py-10 text-center" elevation="none">
      <div
        aria-hidden="true"
        className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-neutral-bg text-heading-4 text-neutral-text"
      >
        0
      </div>
      <Heading className="type-heading-4 mt-4">{title}</Heading>
      <p className="mx-auto mt-2 max-w-reading text-body-sm text-text-secondary">{body}</p>
    </Card>
  );
}
