/**
 * index.js — React application entry point
 *
 * This file mounts the React app onto the #root div in public/index.html.
 * It wraps the whole app in AuthProvider so every component can access
 * the logged-in user state via useAuth().
 *
 * Placement: client/src/index.js
 * Dependencies: react, react-dom, react-router-dom, AuthContext, App
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./utils/AuthContext";
import App from "./App";

// Import global CSS — design tokens, resets, shared utilities
import "./styles/global.css";

// Mount the app
const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    {/*
      BrowserRouter: enables client-side routing with the HTML5 History API.
      AuthProvider: wraps the whole app so any component can call useAuth().
    */}
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
