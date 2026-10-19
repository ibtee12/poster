"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnalyticsSummary } from "@/lib/analytics";

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState("7d");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async (selectedRange = range) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/analytics?range=${selectedRange}`);
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!res.ok) throw new Error("Failed to load analytics");
      const data = await res.json();
      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(range);
  }, [range]);

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
            <span style={{ fontSize: "0.9rem", color: "#64748b" }}>Analytics</span>
          </div>
          <h1 style={{ fontSize: "1.6rem", color: "#0f172a" }}>📊 Poster Maker Analytics</h1>
          <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
            Real-time usage metrics, funnel completion rates, and error tracking (no PII)
          </p>
        </div>

        {/* Date Range Selector */}
        <div style={{ display: "flex", gap: "0.4rem", background: "#ffffff", padding: "0.3rem", borderRadius: 8, border: "1px solid #cbd5e1" }}>
          {[
            { id: "24h", label: "Last 24 Hours" },
            { id: "7d", label: "Last 7 Days" },
            { id: "30d", label: "Last 30 Days" },
            { id: "all", label: "All Time" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setRange(item.id)}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: 6,
                border: "none",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
                backgroundColor: range === item.id ? "#2563eb" : "transparent",
                color: range === item.id ? "#ffffff" : "#475569",
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
          <p style={{ color: "#64748b" }}>Aggregating analytics data...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {!loading && summary && (
        <div>
          {/* Key Metrics Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              marginBottom: "1.75rem",
            }}
          >
            <div className="card" style={{ padding: "1.25rem", borderRadius: 10, background: "#ffffff", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>Unique Sessions</div>
              <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#0f172a", marginTop: "0.25rem" }}>
                {summary.uniqueSessions}
              </div>
            </div>

            <div className="card" style={{ padding: "1.25rem", borderRadius: 10, background: "#ffffff", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>Templates Opened</div>
              <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#2563eb", marginTop: "0.25rem" }}>
                {summary.opensCount}
              </div>
            </div>

            <div className="card" style={{ padding: "1.25rem", borderRadius: 10, background: "#ffffff", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>Posters Exported</div>
              <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#16a34a", marginTop: "0.25rem" }}>
                {summary.exportsCount}
              </div>
            </div>

            <div className="card" style={{ padding: "1.25rem", borderRadius: 10, background: "#ffffff", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>Posters Saved</div>
              <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#8b5cf6", marginTop: "0.25rem" }}>
                {summary.savesCount}
              </div>
            </div>

            <div className="card" style={{ padding: "1.25rem", borderRadius: 10, background: "#ffffff", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>Completion Rate</div>
              <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#d97706", marginTop: "0.25rem" }}>
                {summary.completionRate}%
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.15rem" }}>Opened vs Exported</div>
            </div>
          </div>

          {/* Breakdown Tables (2 columns on desktop) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "1.5rem" }}>
            {/* Events by Template */}
            <div className="card" style={{ padding: "1.25rem", borderRadius: 10, background: "#ffffff", border: "1px solid #e2e8f0" }}>
              <h2 style={{ fontSize: "1.15rem", color: "#0f172a", marginBottom: "0.75rem" }}>
                Templates Activity
              </h2>
              {Object.keys(summary.eventsByTemplate).length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>No template events recorded in this period.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                      <th style={{ padding: "0.5rem" }}>Template ID</th>
                      <th style={{ padding: "0.5rem", textAlign: "right" }}>Total Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(summary.eventsByTemplate)
                      .sort((a, b) => b[1] - a[1])
                      .map(([tplId, count]) => (
                        <tr key={tplId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "0.5rem", fontFamily: "monospace" }}>{tplId}</td>
                          <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: 600 }}>{count}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Top Errors */}
            <div className="card" style={{ padding: "1.25rem", borderRadius: 10, background: "#ffffff", border: "1px solid #e2e8f0" }}>
              <h2 style={{ fontSize: "1.15rem", color: "#0f172a", marginBottom: "0.75rem" }}>
                Top Errors &amp; Drop-offs
              </h2>
              {summary.topErrors.length === 0 ? (
                <p style={{ color: "#16a34a", fontSize: "0.9rem" }}>✓ No errors recorded in this period!</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                      <th style={{ padding: "0.5rem" }}>Error Type</th>
                      <th style={{ padding: "0.5rem", textAlign: "right" }}>Occurrences</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topErrors.map((err) => (
                      <tr key={err.errorType} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.5rem", color: "#dc2626", fontWeight: 600 }}>
                          {err.errorType}
                        </td>
                        <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: 700 }}>
                          {err.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
