import axios from 'axios';
import { API_URL } from '../config/config';

export const api = axios.create({
  baseURL: API_URL,
  // Fayllar yuklanishini hisobga olib umumiy timeout 30 soniyaga oshirildi
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Xatoliklarni qulay kuzatish uchun response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error(
        `❌ API Xatosi [${error.response.status}] ${error.config?.method?.toUpperCase()} ${error.config?.url}:`,
        error.response.data?.message || error.response.data || error.message,
      );
    } else if (error.request) {
      console.error(
        `❌ API Javob bermadi (Server offline bo‘lishi mumkin) ${error.config?.url}:`,
        error.message,
      );
    } else {
      console.error('❌ API So‘rov xatosi:', error.message);
    }

    return Promise.reject(error);
  },
);