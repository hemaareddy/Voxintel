/**
 * Navbar.jsx
 * Top navigation bar — shows logo, nav links, and user controls.
 * Hidden on the login/register pages.
 */

import React from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";

export default function Navbar() {
  const { user, logout, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Hide the navbar entirely on the public landing page
  // (LandingPage has its own inline nav)
  if (!isLoggedIn && location.pathname === "/") return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <Link to="/" className="navbar-brand">
          <span className="brand-dot" />
          VoxIntel
        </Link>

        {/* Nav links (only shown when logged in) */}
        {isLoggedIn && (
          <ul className="navbar-links">
            <li>
              <NavLink to="/dashboard" className={({ isActive }) => isActive ? "active" : ""}>
                Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink to="/resume" className={({ isActive }) => isActive ? "active" : ""}>
                Resume
              </NavLink>
            </li>
            <li>
              <NavLink to="/setup" className={({ isActive }) => isActive ? "active" : ""}>
                Practice
              </NavLink>
            </li>
            <li>
              <NavLink to="/analytics" className={({ isActive }) => isActive ? "active" : ""}>
                Analytics
              </NavLink>
            </li>
          </ul>
        )}

        {/* User controls */}
        <div className="flex items-center gap-md">
          {isLoggedIn ? (
            <>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {user?.name}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
              <Link to="/register" className="btn btn-outline btn-sm">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
