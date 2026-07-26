import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface PortalProps {
  children: ReactNode;
}

const OVERLAY_ROOT_ID = 'overlay-root';

function getOverlayRoot(): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const existingRoot = document.getElementById(OVERLAY_ROOT_ID);
  if (existingRoot) {
    return existingRoot;
  }

  const root = document.createElement('div');
  root.id = OVERLAY_ROOT_ID;
  document.body.append(root);
  return root;
}

export function Portal({ children }: PortalProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(getOverlayRoot());
  }, []);

  return container ? createPortal(children, container) : null;
}
