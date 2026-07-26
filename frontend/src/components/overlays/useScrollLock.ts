import { useEffect } from 'react';

let activeLocks = 0;
let previousOverflow = '';

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    if (activeLocks === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    activeLocks += 1;

    return () => {
      activeLocks = Math.max(0, activeLocks - 1);
      if (activeLocks === 0) {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [active]);
}
