import React from "react";

export interface ProgressBarProps {
  progress?: number; // 0 to 100 or undefined for indeterminate
  message?: string;
  className?: string;
}

export function ProgressBar({ progress, message, className = "" }: ProgressBarProps) {
  const isIndeterminate = progress === undefined;

  return (
    <div style={{ width: "100%", margin: "0.75rem 0" }} className={className}>
      {message && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem", fontSize: "0.9rem", fontWeight: 600, color: "var(--green-700)" }}>
          <span>{message}</span>
          {!isIndeterminate && <span>{Math.round(progress)}%</span>}
        </div>
      )}
      <div className="progress-container">
        <div
          className="progress-bar"
          style={{
            width: isIndeterminate ? "100%" : `${Math.max(0, Math.min(100, progress))}%`,
            animation: isIndeterminate ? "indeterminatePulse 1.4s ease-in-out infinite" : undefined,
          }}
        />
      </div>
    </div>
  );
}
