import axios from 'axios';
import { getAdmin } from '../auth/adminSession';
import { getApplicant, signOutApplicant } from '../auth/session';
import { getStaff } from '../auth/staffSession';
import { getPlatform } from '../auth/platformSession';

declare module 'axios' {
  interface AxiosRequestConfig {
    authScope?: 'admin' | 'platform' | 'staff' | 'applicant';
  }
}

const baseURL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5050/api' : '/api');

const api = axios.create({
  baseURL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const scope = config.authScope;
  const token =
    scope === 'admin'
      ? getAdmin()?.token
      : scope === 'platform'
        ? getPlatform()?.token
        : scope === 'staff'
        ? getStaff()?.token
        : scope === 'applicant'
          ? getApplicant()?.token
          : null;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.authScope === 'applicant' && getApplicant()?.token) {
      signOutApplicant();
      const path = window.location.pathname;
      const accepted = error.response?.data?.code === 'ADMISSION_ACCEPTED';
      const target = accepted || path.startsWith('/student') ? '/login' : '/apply';
      if (path !== target) {
        window.location.assign(target);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
