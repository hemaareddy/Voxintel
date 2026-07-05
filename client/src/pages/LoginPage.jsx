/**
 * LoginPage.jsx
 * User sign-in form. On success, stores token and redirects to dashboard.
 */

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI } from "../utils/api";
import { useAuth } from "../utils/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.login(form);
      login(res.data.user, res.data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center" style={{ flexDirection: "column" }}>
      {/* Brand mark */}
      <div style={{ textAlign: "center", marginBottom: "var(--space-xl)" }} className="animate-fade-in">
        <div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          <span style={{ color: "var(--accent)" }}>Vox</span>Intel
        </div>
        <p style={{ color: "var(--text-muted)", marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "0.78rem", letterSpacing: "0.08em" }}>
          INTERVIEW INTELLIGENCE PLATFORM
        </p>
      </div>

      {/* Form card */}
      <div className="card animate-fade-in-1" style={{ width: "100%", maxWidth: 420 }}>
        <h3 style={{ marginBottom: "var(--space-lg)" }}>Sign in to your account</h3>

        {error && <div className="alert alert-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            style={{ marginTop: "var(--space-sm)" }}
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : "Sign in"}
          </button>
        </form>

        <div className="divider" />

        <p style={{ textAlign: "center", fontSize: "0.88rem", color: "var(--text-muted)" }}>
          Don't have an account?{" "}
          <Link to="/register">Create one</Link>
        </p>

        {/* Demo credentials */}
        <div className="alert alert-info" style={{ marginTop: "var(--space-md)", fontSize: "0.82rem" }}>
          <strong>Demo:</strong> demo@voxintel.com / demo1234
        </div>
      </div>
    </div>
  );
}
