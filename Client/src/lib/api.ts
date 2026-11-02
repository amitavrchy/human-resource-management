import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
export const api = axios.create({ baseURL: '/api', withCredentials: true, timeout: 70000 });
let refreshing: Promise<unknown> | null = null;
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { retried?: boolean }) | undefined;
    if (
      error.response?.status === 401 &&
      config &&
      !config.retried &&
      !config.url?.startsWith('/auth/')
    ) {
      config.retried = true;
      if (!refreshing)
        refreshing = api.post('/auth/refresh').finally(() => {
          refreshing = null;
        });
      try {
        await refreshing;
        return await api(config);
      } catch {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);
export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string | string[] } | undefined)?.message;
    if (message) return Array.isArray(message) ? message[0] : message;
    if (!error.response) return 'Could not connect. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}
