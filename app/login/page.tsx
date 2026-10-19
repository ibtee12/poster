"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/my-posters";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      router.push(returnUrl);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 440, padding: "3rem 1rem" }}>
      <div
        className="card"
        style={{
          background: "#ffffff",
          padding: "2rem",
          borderRadius: 12,
          border: "2px solid #e2e8f0",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem", textAlign: "center" }}>
          Log In
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.95rem", textAlign: "center", marginBottom: "1.5rem" }}>
          Sign in to save and manage your posters
        </p>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.35rem" }}>
              Email Address
            </label>
            <input
              type="email"
              required
              className="text-slot-input"
              style={{ minHeight: 48, fontSize: "1rem" }}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.35rem" }}>
              Password
            </label>
            <input
              type="password"
              required
              className="text-slot-input"
              style={{ minHeight: 48, fontSize: "1rem" }}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-large btn-large-primary"
            style={{ width: "100%", marginTop: "0.5rem" }}
          >
            {loading ? "Signing in..." : "Log In"}
          </button>
        </form>

        <div style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.9rem", color: "#64748b" }}>
          Don't have an account yet?{" "}
          <Link href={`/signup?returnUrl=${encodeURIComponent(returnUrl)}`} style={{ color: "#2563eb", fontWeight: 600 }}>
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="container" style={{ textAlign: "center", padding: "4rem 1rem" }}>
          <div className="loading-spinner" style={{ margin: "0 auto 1.5rem" }} />
          <p>Loading...</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
