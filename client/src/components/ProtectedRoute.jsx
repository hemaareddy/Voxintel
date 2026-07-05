/**
 * ProtectedRoute.jsx
 * Wraps routes that require authentication.
 * Redirects to /login if user is not authenticated.
 */

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isLoggedIn, loading } = useAuth();

  // Wait until we've checked localStorage before deciding
  if (loading) {
    return (
      <div className="page-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
