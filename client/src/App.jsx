/**
 * App.jsx — Root component and route definitions
 *
 * Defines all page routes for the VoxIntel frontend.
 * Protected routes redirect to /login if the user is not authenticated.
 * The Navbar is rendered on every page except login/register.
 *
 * Placement: client/src/App.jsx
 * Dependencies: react-router-dom, all page components, Navbar, ProtectedRoute
 *
 * Route map:
 *   /               → redirect to /dashboard (or /login if not authed)
 *   /login          → LoginPage
 *   /register       → RegisterPage
 *   /dashboard      → DashboardPage     (protected)
 *   /resume         → ResumePage        (protected)
 *   /setup          → SetupPage         (protected)
 *   /interview      → InterviewPage     (protected)
 *   /results        → ResultsPage       (protected)
 *   /analytics      → AnalyticsPage     (protected)
 *   *               → 404 fallback
 */

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Layout components
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import LoginPage    from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import LandingPage    from "./pages/LandingPage";
import DashboardPage  from "./pages/DashboardPage";
import ResumePage     from "./pages/ResumePage";
import SetupPage      from "./pages/SetupPage";
import InterviewPage  from "./pages/InterviewPage";
import ResultsPage    from "./pages/ResultsPage";
import AnalyticsPage  from "./pages/AnalyticsPage";

// Auth context (to decide where "/" redirects)
import { useAuth } from "./utils/AuthContext";

export default function App() {
  const { isLoggedIn, loading } = useAuth();

  // Don't render routes until we know if user is logged in
  // (prevents flash of login page on refresh when user is already authed)
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-base)",
        }}
      >
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      {/*
        Navbar is rendered on every page.
        It internally hides nav links when on login/register pages.
      */}
      <Navbar />

      <Routes>
        {/* Root: redirect based on auth state */}
        <Route
          path="/"
          element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <LandingPage />}
        />

        {/* Public routes — accessible without login */}
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes — require login */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/resume"
          element={
            <ProtectedRoute>
              <ResumePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <SetupPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/interview"
          element={
            <ProtectedRoute>
              <InterviewPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/results"
          element={
            <ProtectedRoute>
              <ResultsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />

        {/* 404 — catch all unmatched routes */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

/* ── Simple 404 component ──────────────────────────────────── */
function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        fontFamily: "var(--font-mono)",
      }}
    >
      <div style={{ fontSize: "4rem", opacity: 0.2 }}>404</div>
      <div style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
        Page not found
      </div>
      <a href="/dashboard" className="btn btn-outline btn-sm">
        ← Back to dashboard
      </a>
    </div>
  );
}
