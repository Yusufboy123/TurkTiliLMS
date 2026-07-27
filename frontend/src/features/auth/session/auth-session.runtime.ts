import { installAuthenticationInterceptors } from '../../../lib/api-client';
import { apiClient } from '../../../lib/api-client';
import { authApi } from '../api/auth.api';
import { createAuthSessionController } from './auth-session.controller';
import { authSessionStore } from './auth-session.store';

export const authSessionController = createAuthSessionController(authApi, authSessionStore);

let disposeTransport: (() => void) | null = null;

export function initializeAuthTransport(): void {
  if (disposeTransport) return;

  disposeTransport = installAuthenticationInterceptors(apiClient, {
    clearSession: authSessionStore.clear,
    getAccessToken: authSessionStore.getAccessToken,
    refreshAccessToken: authSessionController.refreshAccessToken,
  });
}
