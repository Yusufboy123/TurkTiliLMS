import { useEffect } from 'react';

let activeIsolations = 0;
const previousInertValues = new Map<HTMLElement, boolean>();

export function useModalIsolation(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    if (activeIsolations === 0) {
      for (const child of Array.from(document.body.children)) {
        if (!(child instanceof HTMLElement) || child.id === 'overlay-root') {
          continue;
        }
        previousInertValues.set(child, child.inert);
        child.inert = true;
      }
    }
    activeIsolations += 1;

    return () => {
      activeIsolations = Math.max(0, activeIsolations - 1);
      if (activeIsolations !== 0) {
        return;
      }

      for (const [element, wasInert] of previousInertValues) {
        if (element.isConnected) {
          element.inert = wasInert;
        }
      }
      previousInertValues.clear();
    };
  }, [active]);
}
