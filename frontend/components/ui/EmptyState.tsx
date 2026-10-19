import React from "react";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`card ${className}`}
      style={{
        textAlign: "center",
        padding: "3.5rem 1.5rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        maxWidth: 540,
        margin: "1.5rem auto",
      }}
    >
      {icon && (
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            backgroundColor: "var(--green-50)",
            color: "var(--green-600)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1.25rem",
          }}
        >
          {icon}
        </div>
      )}
      <h3 style={{ fontSize: "1.35rem", marginBottom: "0.5rem", color: "var(--text)" }}>{title}</h3>
      {description && (
        <p style={{ maxWidth: 420, marginBottom: actionLabel ? "1.5rem" : 0, color: "var(--text-muted)" }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="secondary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
