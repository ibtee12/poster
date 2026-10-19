import React from "react";
import { CheckIcon, CloseIcon } from "./Icons";

export interface ToastProps {
  type?: "success" | "error" | "warning";
  message: string;
  onClose?: () => void;
}

export function Toast({ type = "success", message, onClose }: ToastProps) {
  const bg = type === "success" ? "var(--green-700)" : type === "error" ? "var(--red-700)" : "var(--gold)";
  const color = type === "warning" ? "#000000" : "#ffffff";

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 2000,
        backgroundColor: bg,
        color,
        padding: "0.85rem 1.25rem",
        borderRadius: "var(--radius-pill)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        fontSize: "0.95rem",
        fontWeight: 600,
        animation: "fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      role="status"
    >
      {type === "success" && <CheckIcon size={18} />}
      <span>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close notification"
          style={{
            background: "transparent",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            opacity: 0.85,
            padding: 2,
          }}
        >
          <CloseIcon size={16} />
        </button>
      )}
    </div>
  );
}
