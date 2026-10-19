"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ReportItem {
  id: string;
  reason: string;
  details?: string;
  status: "pending" | "resolved" | "dismissed";
  resolutionNote?: string;
  createdAt: string;
  poster?: {
    id: string;
    title?: string;
    templateId: string;
    previewImagePath: string;
    userId: string;
  };
  user?: {
    id: string;
    email: string;
  };
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolution modal state
  const [resolvingReport, setResolvingReport] = useState<ReportItem | null>(null);
  const [resolutionAction, setResolutionAction] = useState<"resolved" | "dismissed">("resolved");
  const [resolutionNote, setResolutionNote] = useState("");
  const [deletePoster, setDeletePoster] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchReports = async (filter = statusFilter) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/reports?status=${filter}`);
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!res.ok) throw new Error("Failed to load reports");
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(statusFilter);
  }, [statusFilter]);

  const handleOpenResolve = (report: ReportItem, action: "resolved" | "dismissed") => {
    setResolvingReport(report);
    setResolutionAction(action);
    setResolutionNote("");
    setDeletePoster(action === "resolved");
  };

  const handleConfirmResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingReport) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/reports/${resolvingReport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: resolutionAction,
          resolutionNote,
          deletePoster,
        }),
      });

      if (!res.ok) throw new Error("Failed to update report");

      setResolvingReport(null);
      await fetchReports(statusFilter);
    } catch (err: any) {
      alert(err.message || "Failed to resolve report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 1200, padding: "2rem 1rem" }}>
      {/* Header */}
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
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem" }}>
            <Link href="/admin" style={{ color: "#2563eb", fontWeight: 600, fontSize: "0.9rem" }}>
              ← Admin Studio
            </Link>
            <span style={{ color: "#94a3b8" }}>/</span>
            <span style={{ fontSize: "0.9rem", color: "#64748b" }}>Safety &amp; Reports</span>
          </div>
          <h1 style={{ fontSize: "1.6rem", color: "#0f172a" }}>🚩 Content &amp; Poster Reports</h1>
          <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
            Review flagged posters, handle impersonation or false statements, and enforce community standards
          </p>
        </div>

        {/* Status Filter */}
        <div style={{ display: "flex", gap: "0.4rem", background: "#ffffff", padding: "0.3rem", borderRadius: 8, border: "1px solid #cbd5e1" }}>
          {[
            { id: "pending", label: "Pending Review" },
            { id: "resolved", label: "Resolved" },
            { id: "dismissed", label: "Dismissed" },
            { id: "all", label: "All Reports" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id)}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: 6,
                border: "none",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
                backgroundColor: statusFilter === item.id ? "#2563eb" : "transparent",
                color: statusFilter === item.id ? "#ffffff" : "#475569",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
          <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
          <p style={{ color: "#64748b" }}>Loading reports...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {!loading && !error && reports.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "4rem 1rem",
            background: "#ffffff",
            borderRadius: 12,
            border: "2px dashed #cbd5e1",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🛡️</div>
          <h2 style={{ fontSize: "1.25rem", color: "#1e293b", marginBottom: "0.35rem" }}>No Reports Found</h2>
          <p style={{ color: "#64748b" }}>No reports match the current filter.</p>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {reports.map((rep) => (
            <div
              key={rep.id}
              className="card"
              style={{
                background: "#ffffff",
                padding: "1.25rem",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                display: "flex",
                flexWrap: "wrap",
                gap: "1.25rem",
                alignItems: "flex-start",
              }}
            >
              {/* Poster Thumbnail (if poster exists) */}
              <div
                style={{
                  width: 110,
                  height: 140,
                  backgroundColor: "#0f172a",
                  borderRadius: 6,
                  overflow: "hidden",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {rep.poster?.previewImagePath ? (
                  <img
                    src={rep.poster.previewImagePath}
                    alt="Reported poster"
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8", textAlign: "center", padding: "0.25rem" }}>
                    Poster Deleted
                  </span>
                )}
              </div>

              {/* Report Information */}
              <div style={{ flex: "1 1 320px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                  <span
                    className={`badge ${
                      rep.status === "pending"
                        ? "badge-warning"
                        : rep.status === "resolved"
                        ? "badge-success"
                        : "badge-primary"
                    }`}
                  >
                    {rep.status.toUpperCase()}
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                    Reported on {new Date(rep.createdAt).toLocaleString()}
                  </span>
                </div>

                <h3 style={{ fontSize: "1.1rem", color: "#0f172a", marginBottom: "0.25rem" }}>
                  Reason: <span style={{ color: "#dc2626" }}>{rep.reason}</span>
                </h3>

                {rep.details && (
                  <p style={{ fontSize: "0.95rem", color: "#334155", background: "#f8fafc", padding: "0.5rem", borderRadius: 6, margin: "0.5rem 0" }}>
                    "{rep.details}"
                  </p>
                )}

                <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.35rem" }}>
                  {rep.poster ? (
                    <span>
                      Poster ID: <code style={{ color: "#2563eb" }}>{rep.poster.id}</code> (Template: {rep.poster.templateId})
                    </span>
                  ) : (
                    <span>Associated poster was removed</span>
                  )}
                  {rep.user && <span> • Reported by: {rep.user.email}</span>}
                </div>

                {rep.resolutionNote && (
                  <div style={{ fontSize: "0.85rem", color: "#166534", marginTop: "0.35rem" }}>
                    <strong>Admin Note:</strong> {rep.resolutionNote}
                  </div>
                )}
              </div>

              {/* Action Buttons for Pending */}
              {rep.status === "pending" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 160 }}>
                  <button
                    onClick={() => handleOpenResolve(rep, "resolved")}
                    className="btn btn-sm btn-primary"
                    style={{ minHeight: 36, padding: "0.4rem 0.75rem" }}
                  >
                    ✓ Resolve &amp; Take Action
                  </button>
                  <button
                    onClick={() => handleOpenResolve(rep, "dismissed")}
                    className="btn btn-sm btn-secondary"
                    style={{ minHeight: 36, padding: "0.4rem 0.75rem" }}
                  >
                    ✕ Dismiss Report
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolution Modal */}
      {resolvingReport && (
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
            }}
          >
            <h2 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
              {resolutionAction === "resolved" ? "Resolve Report" : "Dismiss Report"}
            </h2>
            <p style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "1rem" }}>
              Report ID: {resolvingReport.id} (Reason: {resolvingReport.reason})
            </p>

            <form onSubmit={handleConfirmResolve} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Resolution Note (optional):
                </label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  className="text-slot-input"
                  placeholder="e.g. Poster violates impersonation policy and was removed."
                  style={{ minHeight: 70, fontSize: "0.95rem" }}
                />
              </div>

              {resolutionAction === "resolved" && resolvingReport.poster && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#fef2f2", padding: "0.75rem", borderRadius: 8, border: "1px solid #fecaca" }}>
                  <input
                    type="checkbox"
                    id="deletePosterCheck"
                    checked={deletePoster}
                    onChange={(e) => setDeletePoster(e.target.checked)}
                    style={{ width: 18, height: 18 }}
                  />
                  <label htmlFor="deletePosterCheck" style={{ fontSize: "0.85rem", color: "#991b1b", fontWeight: 600 }}>
                    Delete offending poster from disk &amp; database
                  </label>
                </div>
              )}

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setResolvingReport(null)}
                  className="btn-large btn-large-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-large btn-large-primary"
                  style={{ flex: 1 }}
                >
                  {submitting ? "Saving..." : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
