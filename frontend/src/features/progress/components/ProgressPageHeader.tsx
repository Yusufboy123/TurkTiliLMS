import { useEffect, useRef } from 'react';

interface ProgressPageHeaderProps {
  description?: string;
  title: string;
}

export function ProgressPageHeader({ description, title }: ProgressPageHeaderProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = `${title} · Turk Tili LMS`;
    headingRef.current?.focus();
  }, [title]);

  return (
    <header className="mb-8 max-w-reading">
      <div aria-hidden="true" className="mb-4 h-1 w-12 rounded-full bg-action-primary-bg" />
      <h1 className="type-heading-1 outline-none" ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      {description ? (
        <p className="mt-3 max-w-reading text-body-md text-text-secondary">{description}</p>
      ) : null}
    </header>
  );
}
