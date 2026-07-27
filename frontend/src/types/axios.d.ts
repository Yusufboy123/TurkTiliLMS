import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    authRetryAttempted?: boolean;
    skipAuthHeader?: boolean;
    skipAuthRefresh?: boolean;
  }
}
