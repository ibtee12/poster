import React from "react";

export function Skeleton({
  width = "100%",
  height = "20px",
  borderRadius = "var(--radius-md)",
  className = "",
  style,
}: {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

export function TemplateCardSkeleton() {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <Skeleton width="100%" height="320px" borderRadius="0" />
      <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <Skeleton width="65%" height="24px" />
        <Skeleton width="40%" height="18px" />
        <Skeleton width="100%" height="48px" borderRadius="var(--radius-pill)" style={{ marginTop: "0.5rem" }} />
      </div>
    </div>
  );
}
