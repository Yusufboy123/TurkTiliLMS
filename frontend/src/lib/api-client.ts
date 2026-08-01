import axios, { AxiosHeaders, type AxiosError, type AxiosInstance } from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10_000,
});

export interface AuthenticationTransport {
  clearSession(): void;
  getAccessToken(): string | null;
  refreshAccessToken(): Promise<string>;
}

export function installAuthenticationInterceptors(
  client: AxiosInstance,
  authentication: AuthenticationTransport,
): () => void {
  const requestInterceptor = client.interceptors.request.use((config) => {
    const headers = AxiosHeaders.from(config.headers);
    const accessToken = config.skipAuthHeader ? null : authentication.getAccessToken();

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    } else {
      headers.delete('Authorization');
    }

    config.headers = headers;
    return config;
  });

  const responseInterceptor = client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const request = error.config;
      const shouldRefresh =
        error.response?.status === 401 &&
        request !== undefined &&
        !request.skipAuthRefresh &&
        !request.authRetryAttempted;

      if (!shouldRefresh || !request) {
        return Promise.reject(error);
      }

      request.authRetryAttempted = true;

      try {
        const nextAccessToken = await authentication.refreshAccessToken();
        const headers = AxiosHeaders.from(request.headers);
        headers.set('Authorization', `Bearer ${nextAccessToken}`);
        request.headers = headers;
        return client.request(request);
      } catch (refreshError: unknown) {
        authentication.clearSession();
        return Promise.reject(refreshError);
      }
    },
  );

  return () => {
    client.interceptors.request.eject(requestInterceptor);
    client.interceptors.response.eject(responseInterceptor);
  };
}

export { apiClient };
