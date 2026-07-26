import { createContext, useContext } from 'react';

export type ToastIntent = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  action?: ToastAction;
  durationMs?: number;
  intent?: ToastIntent;
  message: string;
  title?: string;
}

export interface ToastContextValue {
  dismiss: (id: string) => void;
  show: (toast: ToastInput) => string;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast ToastProvider ichida ishlatilishi kerak.');
  }
  return context;
}
