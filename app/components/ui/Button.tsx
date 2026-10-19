import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  className = "",
  style,
  ...props
}: ButtonProps) {
  let variantClass = "btn-primary";
  if (variant === "secondary") variantClass = "btn-secondary";
  else if (variant === "ghost") variantClass = "btn-ghost";
  else if (variant === "danger") variantClass = "btn-primary"; // Red is danger/primary

  let sizeStyle: React.CSSProperties = {
    minHeight: size === "sm" ? 40 : size === "lg" ? 54 : 48,
    padding: size === "sm" ? "0.45rem 1rem" : size === "lg" ? "0.9rem 2rem" : "0.75rem 1.5rem",
    fontSize: size === "sm" ? "0.9rem" : size === "lg" ? "1.1rem" : "1rem",
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${variantClass} ${className}`}
      style={{ ...sizeStyle, ...style }}
      {...props}
    >
      {loading ? (
        <span
          style={{
            display: "inline-block",
            width: 18,
            height: 18,
            border: "2px solid rgba(255,255,255,0.4)",
            borderTopColor: "#ffffff",
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }}
        />
      ) : (
        icon && <span style={{ display: "inline-flex", alignItems: "center" }}>{icon}</span>
      )}
      {children}
    </button>
  );
}
