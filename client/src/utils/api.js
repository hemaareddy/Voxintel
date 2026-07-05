/**
 * api.js — Centralized Axios API client
 *
 * All HTTP requests go through this instance.
 * It automatically attaches the JWT token from localStorage
 * and handles 401 (token expired) globally.
 */

import axios from "axios";

// In dev, the React dev server proxies /api to localhost:5000 (set in package.json).
// In a production build served from a different origin than the API, set
// REACT_APP_API_URL (e.g. https://api.example.com/api) — see .env.production.example.
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",
  timeout: 30000, // 30 second timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request interceptor: attach JWT ──────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("voxintel_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: handle auth errors globally ────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear local storage and redirect to login
      localStorage.removeItem("voxintel_token");
      localStorage.removeItem("voxintel_user");
      // Only redirect if not already on auth pages
      if (!window.location.pathname.includes("/login") &&
          !window.location.pathname.includes("/register")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Convenience API functions ─────────────────────────────────

// Auth
export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
};

// Resume
export const resumeAPI = {
  upload: (formData) =>
    api.post("/resume/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000, // longer timeout for file uploads + NLP processing
    }),
  list: () => api.get("/resume"),
  status: (id) => api.get(`/resume/${id}/status`),
  insights: (id) => api.get(`/resume/${id}/insights`),
};

// Interview
export const interviewAPI = {
  start: (config) => api.post("/interview/start", config),
  submitAnswer: (data) => api.post("/interview/answer", data),
  complete: (sessionId) => api.post("/interview/complete", { sessionId }),
  getSession: (sessionId) => api.get(`/interview/${sessionId}`),
  history: () => api.get("/interview/history"),
};

// Analytics
export const analyticsAPI = {
  dashboard: () => api.get("/analytics/dashboard"),
};

// Questions
export const questionsAPI = {
  list: (params) => api.get("/questions", { params }),
  categories: () => api.get("/questions/categories"),
};
