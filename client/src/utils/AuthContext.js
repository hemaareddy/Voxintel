/**
 * AuthContext.js
 * Provides global authentication state via React Context.
 * Wraps the entire app — any component can call useAuth() to get user + token.
 */

import React, { createContext, useContext, useState, useEffect } from "react";

// Create the context
const AuthContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true); // true until we've checked localStorage

  // On mount, restore session from localStorage
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem("voxintel_token");
      const savedUser = localStorage.getItem("voxintel_user");
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch {
      // If localStorage is corrupted, start fresh
      localStorage.removeItem("voxintel_token");
      localStorage.removeItem("voxintel_user");
    } finally {
      setLoading(false);
    }
  }, []);

  // Called after successful login or register
  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem("voxintel_token", authToken);
    localStorage.setItem("voxintel_user", JSON.stringify(userData));
  };

  // Called on logout
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("voxintel_token");
    localStorage.removeItem("voxintel_user");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
