import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({
  label,
  error,
  helperText,
  className = "",
  id,
  style,
  ...props
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="form-group" style={{ marginBottom: "1rem" }}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`form-input ${className}`}
        style={{
          borderColor: error ? "var(--red-600)" : undefined,
          ...style,
        }}
        {...props}
      />
      {error ? (
        <p style={{ color: "var(--red-600)", fontSize: "0.85rem", marginTop: "0.25rem", fontWeight: 500 }}>
          {error}
        </p>
      ) : helperText ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Select({
  label,
  error,
  helperText,
  children,
  className = "",
  id,
  style,
  ...props
}: SelectProps) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="form-group" style={{ marginBottom: "1rem" }}>
      {label && (
        <label htmlFor={selectId} className="form-label">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`form-select ${className}`}
        style={{
          borderColor: error ? "var(--red-600)" : undefined,
          ...style,
        }}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p style={{ color: "var(--red-600)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
          {error}
        </p>
      ) : helperText ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
