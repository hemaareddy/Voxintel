/**
 * RegisterPage.jsx
 * New user registration form.
 */

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI } from "../utils/api";
import { useAuth } from "../utils/AuthContext";

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, password, confirmPassword } = form;

    if (!name || !email || !password) return setError("Please fill in all fields.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);
    try {
      const res = await authAPI.register({ name, email, password });
      login(res.data.user, res.data.token);
      navigate("/resume"); // go straight to resume upload
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center" style={{ flexDirection: "column" }}>
      <div style={{ textAlign: "center", marginBottom: "var(--space-xl)" }} className="animate-fade-in">
        <div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          <span style={{ color: "var(--accent)" }}>Vox</span>Intel
        </div>
        <p style={{ color: "var(--text-muted)", marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "0.78rem", letterSpacing: "0.08em" }}>
          INTERVIEW INTELLIGENCE PLATFORM
        </p>
      </div>

      <div className="card animate-fade-in-1" style={{ width: "100%", maxWidth: 420 }}>
        <h3 style={{ marginBottom: "var(--space-lg)" }}>Create your account</h3>

        {error && <div className="alert alert-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <div className="form-group">
            <label>Full Name</label>
            <input name="name" type="text" placeholder="Ada Lovelace" value={form.name} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input name="password" type="password" placeholder="min 6 characters" value={form.password} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input name="confirmPassword" type="password" placeholder="repeat password" value={form.confirmPassword} onChange={handleChange} />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            style={{ marginTop: "var(--space-sm)" }}
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : "Create account"}
          </button>
        </form>

        <div className="divider" />

        <p style={{ textAlign: "center", fontSize: "0.88rem", color: "var(--text-muted)" }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
