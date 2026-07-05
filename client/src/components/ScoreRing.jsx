/**
 * ScoreRing.jsx
 * Circular SVG progress ring that displays a 0-100 score.
 * Used on the Results page and Analytics dashboard.
 */

import React from "react";

function getColor(score) {
  if (score >= 70) return "var(--green)";
  if (score >= 45) return "var(--accent)";
  return "var(--red)";
}

export default function ScoreRing({ score = 0, size = 100, label = "" }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = ((score / 100) * circumference).toFixed(2);
  const color = getColor(score);

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-elevated)"
          strokeWidth="8"
        />
        {/* Filled arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      {/* Center label */}
      <div className="ring-label">
        <div style={{ fontSize: size * 0.2, fontWeight: 600, color, fontFamily: "var(--font-mono)", lineHeight: 1 }}>
          {score}
        </div>
        {label && (
          <div style={{ fontSize: size * 0.1, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
            {label}
          </div>
        )}
      </div>
    </div>
  );
}
