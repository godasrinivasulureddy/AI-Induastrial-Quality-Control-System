import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 || error.response?.status === 401) {
      // Clear token globally and log out reactively to sync UI routes
      import("../store/useAppStore").then((module) => {
        module.useAppStore.getState().logout();
      }).catch(() => {
        localStorage.removeItem("accessToken");
      });
    }
    return Promise.reject(error);
  },

);
