/**
 * ProgressBar.jsx
 * Simple labeled progress bar. Color is determined by score.
 */

import React from "react";

function getVariant(score) {
  if (score >= 70) return "green";
  if (score >= 45) return "";   // default = amber
  return "red";
}

export default function ProgressBar({ label, score = 0, showScore = true }) {
  const variant = getVariant(score);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{label}</span>
        {showScore && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {score}/100
          </span>
        )}
      </div>
      <div className="progress-bar">
        <div
          className={`progress-bar-fill ${variant}`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
    </div>
  );
}
