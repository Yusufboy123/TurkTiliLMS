import type { OverlaySurfaceProps } from './OverlaySurface';
import { OverlaySurface } from './OverlaySurface';

export type ModalProps = Omit<OverlaySurfaceProps, 'kind'>;

export function Modal(props: ModalProps) {
  return <OverlaySurface {...props} kind="modal" />;
}

export const Dialog = Modal;
