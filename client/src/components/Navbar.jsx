/**
 * Navbar.jsx
 * Top navigation bar — shows logo, nav links, and user controls.
 * Hidden on the login/register pages and during an active interview.
 */

import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";

export default function Navbar() {
  const { user, logout, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile dropdown on every navigation, including browser back/forward.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Hide the navbar entirely on the public landing page
  // (LandingPage has its own inline nav)
  if (!isLoggedIn && location.pathname === "/") return null;

  // Hide during the interview: the lockdown feature enforces fullscreen and
  // blocks tab/window switching, but a persistent navbar would leave a link
  // straight to Dashboard/Resume/etc. as an escape hatch that defeats it.
  if (location.pathname === "/interview") return null;

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <Link to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
          <img src="/logo.jpg" alt="VoxIntel" className="navbar-logo" />
          VoxIntel
        </Link>

        {/* Hamburger toggle — only visible once the links/user controls no
            longer fit in one row (see the max-width: 768px rule in global.css) */}
        <button
          className="navbar-toggle"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {menuOpen ? (
              <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>
            ) : (
              <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
            )}
          </svg>
        </button>

        {/* On desktop this row shows inline; on mobile it collapses into a
            dropdown panel toggled by navbar-toggle (see global.css). */}
        <div className={`navbar-collapsible ${menuOpen ? "open" : ""}`}>
          {/* Nav links (only shown when logged in) */}
          {isLoggedIn && (
            <ul className="navbar-links">
              <li>
                <NavLink to="/dashboard" className={({ isActive }) => isActive ? "active" : ""} onClick={() => setMenuOpen(false)}>
                  Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink to="/resume" className={({ isActive }) => isActive ? "active" : ""} onClick={() => setMenuOpen(false)}>
                  Resume
                </NavLink>
              </li>
              <li>
                <NavLink to="/setup" className={({ isActive }) => isActive ? "active" : ""} onClick={() => setMenuOpen(false)}>
                  Practice
                </NavLink>
              </li>
              <li>
                <NavLink to="/analytics" className={({ isActive }) => isActive ? "active" : ""} onClick={() => setMenuOpen(false)}>
                  Analytics
                </NavLink>
              </li>
            </ul>
          )}

          {/* User controls */}
          <div className="navbar-user flex items-center gap-md">
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
                <Link to="/login" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>Sign in</Link>
                <Link to="/register" className="btn btn-outline btn-sm" onClick={() => setMenuOpen(false)}>Register</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
