import React, { useEffect } from "react";
import { CloseIcon } from "./Icons";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: number;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 500 }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(18, 38, 29, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        zIndex: 1000,
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          maxWidth,
          width: "100%",
          padding: "1.75rem",
          boxShadow: "var(--shadow-lg)",
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        role="dialog"
        aria-modal="true"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          {title ? (
            <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
              {title}
            </h3>
          ) : <div />}
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.4rem",
              borderRadius: "50%",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background-color 0.15s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--green-50)")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <CloseIcon size={20} />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
