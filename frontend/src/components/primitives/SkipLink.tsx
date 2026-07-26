import { type MouseEvent } from 'react';

export interface SkipLinkProps {
  label?: string;
  targetId: string;
}

export function SkipLink({ label = 'Asosiy kontentga o‘tish', targetId }: SkipLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(targetId);

    if (!target) {
      event.preventDefault();
      if (import.meta.env.DEV) {
        throw new Error(`SkipLink nishoni topilmadi: #${targetId}`);
      }
      return;
    }

    target.focus();
  };

  return (
    <a
      className="fixed left-4 top-4 z-skip-link -translate-y-24 rounded-md bg-raised px-4 py-3 text-label-md text-link shadow-dropdown transition-transform duration-fast focus:translate-y-0"
      href={`#${targetId}`}
      onClick={handleClick}
    >
      {label}
    </a>
  );
}
