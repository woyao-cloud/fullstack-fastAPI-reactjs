import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/auth";

function createClient(baseURL: string): AxiosInstance {
  const instance = axios.create({ baseURL, headers: { "Content-Type": "application/json" } });

  instance.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  let isRefreshing = false;
  let failedQueue: Array<{ resolve: (token: string | null) => void; reject: (err: unknown) => void }> = [];
  const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
    failedQueue = [];
  };

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise<string | null>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((token) => {
            if (token) originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${token}` };
            return instance(originalRequest);
          });
        }
        originalRequest._retry = true;
        isRefreshing = true;
        try {
          const newToken = await useAuthStore.getState().refreshAccessToken();
          if (newToken) {
            processQueue(null, newToken);
            originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${newToken}` };
            return instance(originalRequest);
          }
          useAuthStore.getState().logout();
          return Promise.reject(error);
        } catch (err) {
          processQueue(err, null);
          useAuthStore.getState().logout();
          return Promise.reject(err);
        } finally {
          isRefreshing = false;
        }
      }
      return Promise.reject(error);
    }
  );
  return instance;
}

export const api = createClient("/api/v1");
export const internalApi = createClient("/internal");
