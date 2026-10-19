import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ children, interactive = false, className = "", style, ...props }: CardProps) {
  return (
    <div
      className={`card ${interactive ? "template-card" : ""} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}
