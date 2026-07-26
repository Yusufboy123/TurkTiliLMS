import type { OverlaySurfaceProps } from './OverlaySurface';
import { OverlaySurface } from './OverlaySurface';

export type DrawerPlacement = 'start' | 'end' | 'bottom';

export interface DrawerProps extends Omit<OverlaySurfaceProps, 'kind'> {
  placement?: DrawerPlacement;
}

export function Drawer({ placement = 'end', ...props }: DrawerProps) {
  return <OverlaySurface {...props} kind={`drawer-${placement}`} />;
}
