"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SavedPoster {
  id: string;
  templateId: string;
  layoutId?: string;
  variantId?: string;
  title?: string;
  previewImagePath: string;
  createdAt: string;
}

export default function MyPostersPage() {
  const router = useRouter();
  const [posters, setPosters] = useState<SavedPoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reporting modal state
  const [reportingPoster, setReportingPoster] = useState<SavedPoster | null>(null);
  const [reportReason, setReportReason] = useState("Impersonation");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const fetchPosters = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/posters");

      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to load saved posters");
      }

      const data = await res.json();
      setPosters(data.posters || []);
    } catch (err: any) {
      setError(err.message || "Failed to load posters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosters();
  }, []);

  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/posters/${id}/duplicate`, { method: "POST" });
      if (res.ok) {
        await fetchPosters();
      } else {
        alert("Failed to duplicate poster");
      }
    } catch (e) {
      alert("Error duplicating poster");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this poster? This cannot be undone.")) {
      return;
    }
    try {
      const res = await fetch(`/api/posters/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPosters((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert("Failed to delete poster");
      }
    } catch (e) {
      alert("Error deleting poster");
    }
  };

  const handleOpenReport = (poster: SavedPoster) => {
    setReportingPoster(poster);
    setReportReason("Impersonation");
    setReportDetails("");
    setReportSuccess(false);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingPoster) return;

    setReportLoading(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posterId: reportingPoster.id,
          reason: reportReason,
          details: reportDetails,
        }),
      });

      if (res.ok) {
        setReportSuccess(true);
        setTimeout(() => {
          setReportingPoster(null);
        }, 1800);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to submit report");
      }
    } catch (e) {
      alert("Error submitting report");
    } finally {
      setReportLoading(false);
    }
  };

  if (unauthorized) {
    return (
      <div className="container" style={{ maxWidth: 500, padding: "4rem 1rem", textAlign: "center" }}>
        <div className="card" style={{ padding: "2.5rem 1.5rem", borderRadius: 12, border: "2px solid #e2e8f0" }}>
          <h1 style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>Sign in to View Your Posters</h1>
          <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
            You need to be logged in to view your saved posters and edit history.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <Link href="/login?returnUrl=/my-posters" className="btn-large btn-large-primary">
              Log In
            </Link>
            <Link href="/signup?returnUrl=/my-posters" className="btn-large btn-large-secondary">
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 1200, padding: "2rem 1rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.6rem", color: "#0f172a" }}>My Saved Posters</h1>
          <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
            View, re-open for editing, duplicate, or manage your creations
          </p>
        </div>
        <Link href="/" className="btn-large btn-large-primary">
          + Create New Poster
        </Link>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
          <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
          <p style={{ color: "#64748b" }}>Loading your posters...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {!loading && !error && posters.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "4rem 1rem",
            background: "#ffffff",
            borderRadius: 12,
            border: "2px dashed #cbd5e1",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🎨</div>
          <h2 style={{ fontSize: "1.3rem", color: "#1e293b", marginBottom: "0.5rem" }}>No Saved Posters Yet</h2>
          <p style={{ color: "#64748b", maxWidth: 400, margin: "0 auto 1.5rem" }}>
            You haven't saved any posters yet. Choose a template and click "Save poster" to add it here.
          </p>
          <Link href="/" className="btn-large btn-large-primary">
            Explore Templates
          </Link>
        </div>
      )}

      {!loading && posters.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {posters.map((poster) => (
            <div
              key={poster.id}
              className="card"
              style={{
                background: "#ffffff",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              {/* Thumbnail Container */}
              <div
                style={{
                  background: "#0f172a",
                  aspectRatio: "3 / 4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {poster.previewImagePath ? (
                  <img
                    src={poster.previewImagePath}
                    alt={poster.title || "Poster Thumbnail"}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>No Preview Available</span>
                )}
              </div>

              {/* Info & Actions */}
              <div style={{ padding: "1rem", flex: 1, display: "flex", flexDirection: "column" }}>
                <h3 style={{ fontSize: "1.05rem", color: "#0f172a", marginBottom: "0.25rem" }}>
                  {poster.title || "Custom Poster"}
                </h3>
                <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "1rem" }}>
                  Created on {new Date(poster.createdAt).toLocaleDateString()}
                </div>

                <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {/* Reopen & Edit Button */}
                  <Link
                    href={`/make/${poster.templateId}?posterId=${poster.id}`}
                    className="btn-large btn-large-primary"
                    style={{ minHeight: 44, fontSize: "0.95rem" }}
                  >
                    ✏️ Reopen & Edit
                  </Link>

                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {/* Duplicate Button */}
                    <button
                      type="button"
                      onClick={() => handleDuplicate(poster.id)}
                      className="btn-large btn-large-secondary"
                      style={{ flex: 1, minHeight: 40, fontSize: "0.85rem" }}
                      title="Make a copy"
                    >
                      📋 Duplicate
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(poster.id)}
                      className="btn-large btn-large-secondary"
                      style={{ flex: 1, minHeight: 40, fontSize: "0.85rem", color: "#dc2626" }}
                      title="Delete poster"
                    >
                      🗑️ Delete
                    </button>
                  </div>

                  {/* Report Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenReport(poster)}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "0.8rem",
                      color: "#94a3b8",
                      cursor: "pointer",
                      textAlign: "center",
                      marginTop: "0.25rem",
                      textDecoration: "underline",
                    }}
                  >
                    🚩 Report this poster
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reporting Modal */}
      {reportingPoster && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 100,
          }}
        >
          <div
            className="card"
            style={{
              background: "#ffffff",
              padding: "1.75rem",
              borderRadius: 12,
              maxWidth: 460,
              width: "100%",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <h2 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>🚩 Report Poster</h2>
            <p style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "1rem" }}>
              Help us maintain community safety. Reports are reviewed by administrators.
            </p>

            {reportSuccess ? (
              <div className="alert alert-success" style={{ textAlign: "center", padding: "1rem" }}>
                ✓ Thank you. Your report has been submitted and will be reviewed.
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                    Reason for report:
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="text-slot-input"
                    style={{ minHeight: 44, fontSize: "0.95rem" }}
                  >
                    <option value="Impersonation">Impersonation of someone else</option>
                    <option value="False Statements">False or misleading statements</option>
                    <option value="Hate Speech">Hate speech or harassment</option>
                    <option value="Inappropriate Content">Inappropriate or explicit content</option>
                    <option value="Other">Other misuse</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                    Additional details (optional):
                  </label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    className="text-slot-input"
                    placeholder="Provide any additional context..."
                    style={{ minHeight: 80, fontSize: "0.95rem" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setReportingPoster(null)}
                    className="btn-large btn-large-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportLoading}
                    className="btn-large btn-large-danger"
                    style={{ flex: 1 }}
                  >
                    {reportLoading ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
