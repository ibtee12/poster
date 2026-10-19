"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function Navbar() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch {
        setUser(null);
      }
    }
    checkAuth();
  }, [pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/");
      router.refresh();
    } catch (e) {
      console.warn("Logout error:", e);
    }
  };

  const isHomeActive = pathname === "/";
  const isAdminActive = pathname.startsWith("/admin");

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Brand / Logo */}
        <Link href="/" className="nav-brand">
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: "var(--red-600)",
              border: "2px solid #ffffff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1rem",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            }}
          >
            🎨
          </span>
          <span>পোস্টার মেকার</span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="nav-links nav-links-desktop" aria-label="Main Navigation">
          <Link
            href="/"
            className={`nav-link ${isHomeActive ? "active" : ""}`}
          >
            হোম (Home)
          </Link>

          <Link
            href="/admin"
            className={`nav-link ${isAdminActive ? "active" : ""}`}
          >
            অ্যাডমিন (Admin)
          </Link>

          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "0.5rem" }}>
              <span
                style={{
                  fontSize: "0.85rem",
                  color: "#ffffff",
                  background: "rgba(0,0,0,0.2)",
                  padding: "0.25rem 0.65rem",
                  borderRadius: "var(--radius-pill)",
                  fontWeight: 500,
                }}
                title={user.email}
              >
                👤 {user.email.split("@")[0]}
              </span>
              <button
                onClick={handleLogout}
                className="nav-link"
                style={{
                  background: "rgba(214, 40, 57, 0.9)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  color: "#ffffff",
                }}
              >
                লগআউট
              </button>
            </div>
          )}
        </nav>

        {/* Mobile Menu Toggle Button */}
        <button
          type="button"
          className="nav-mobile-toggle"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {mobileMenuOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Collapsed Menu */}
      {mobileMenuOpen && (
        <nav className="nav-mobile-menu" aria-label="Mobile Navigation">
          <Link
            href="/"
            className={`nav-link ${isHomeActive ? "active" : ""}`}
            style={{ padding: "0.75rem 1rem", fontSize: "1.05rem" }}
          >
            🏠 হোম (Home)
          </Link>
          <Link
            href="/admin"
            className={`nav-link ${isAdminActive ? "active" : ""}`}
            style={{ padding: "0.75rem 1rem", fontSize: "1.05rem" }}
          >
            ⚙️ অ্যাডমিন (Admin)
          </Link>
          {user && (
            <div style={{ padding: "0.5rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.85)" }}>
                👤 {user.email}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  background: "var(--red-600)",
                  border: "none",
                  color: "#ffffff",
                  padding: "0.4rem 0.85rem",
                  borderRadius: "var(--radius-pill)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                লগআউট
              </button>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
