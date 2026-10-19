import React from "react";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: "filter" | "badge" | "gold";
}

export function Chip({
  children,
  active = false,
  variant = "filter",
  className = "",
  type = "button",
  ...props
}: ChipProps) {
  if (variant === "badge") {
    return <span className={`badge ${className}`}>{children}</span>;
  }
  if (variant === "gold") {
    return <span className={`badge badge-gold ${className}`}>{children}</span>;
  }

  return (
    <button
      type={type}
      className={`filter-chip ${active ? "active" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
