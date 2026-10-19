"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface BlocklistItem {
  id: string;
  word: string;
  category?: string;
  createdAt: string;
}

export default function AdminBlocklistPage() {
  const [items, setItems] = useState<BlocklistItem[]>([]);
  const [newWord, setNewWord] = useState("");
  const [category, setCategory] = useState("misuse");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchBlocklist = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/safety/blocklist");
      if (!res.ok) throw new Error("Failed to fetch blocklist");
      const data = await res.json();
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to load blocklist");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocklist();
  }, []);

  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/safety/blocklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: newWord.trim(), category }),
      });

      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add word");
      }

      setNewWord("");
      setSuccess(`Added "${newWord.trim()}" to blocklist`);
      await fetchBlocklist();
    } catch (err: any) {
      setError(err.message || "Failed to add word");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWord = async (word: string) => {
    if (!confirm(`Remove "${word}" from blocklist?`)) return;

    try {
      const res = await fetch(`/api/safety/blocklist?word=${encodeURIComponent(word)}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to remove word");

      setItems((prev) => prev.filter((i) => i.word !== word));
    } catch (err: any) {
      alert(err.message || "Failed to delete word");
    }
  };

  return (
    <div className="container" style={{ maxWidth: 900, padding: "2rem 1rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem" }}>
          <Link href="/admin" style={{ color: "#2563eb", fontWeight: 600, fontSize: "0.9rem" }}>
            ← Admin Studio
          </Link>
          <span style={{ color: "#94a3b8" }}>/</span>
          <span style={{ fontSize: "0.9rem", color: "#64748b" }}>Safety Guardrails</span>
        </div>
        <h1 style={{ fontSize: "1.6rem", color: "#0f172a" }}>🛡️ Misuse Guardrails: Blocklist</h1>
        <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
          Configure restricted words and phrases automatically checked on user text inputs to prevent impersonation and fraud
        </p>
      </div>

      {/* Add New Word Form */}
      <div
        className="card"
        style={{
          background: "#ffffff",
          padding: "1.5rem",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ fontSize: "1.15rem", marginBottom: "0.75rem", color: "#0f172a" }}>Add Word or Phrase</h2>

        {error && <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: "1rem" }}>{success}</div>}

        <form onSubmit={handleAddWord} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <input
            type="text"
            required
            placeholder="e.g. fake statement, impersonate..."
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            className="text-slot-input"
            style={{ flex: "2 1 240px", minHeight: 46, fontSize: "0.95rem" }}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-slot-input"
            style={{ flex: "1 1 140px", minHeight: 46, fontSize: "0.95rem" }}
          >
            <option value="misuse">Misuse / Fraud</option>
            <option value="impersonation">Impersonation</option>
            <option value="hate_speech">Hate Speech</option>
            <option value="profanity">Profanity</option>
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="btn-large btn-large-primary"
            style={{ flex: "0 0 auto", minHeight: 46 }}
          >
            {submitting ? "Adding..." : "+ Add to Blocklist"}
          </button>
        </form>
      </div>

      {/* Blocklist Table */}
      <div
        className="card"
        style={{
          background: "#ffffff",
          padding: "1.5rem",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.15rem", color: "#0f172a" }}>
            Active Blocked Words ({items.length})
          </h2>
        </div>

        {loading && <p style={{ color: "#64748b" }}>Loading blocklist...</p>}

        {!loading && items.length === 0 && (
          <p style={{ color: "#94a3b8" }}>No words currently in the blocklist.</p>
        )}

        {!loading && items.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {items.map((item) => (
              <span
                key={item.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.35rem 0.65rem",
                  backgroundColor: "#fef2f2",
                  color: "#991b1b",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  fontSize: "0.9rem",
                  fontWeight: 600,
                }}
              >
                <span>{item.word}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteWord(item.word)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#dc2626",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    padding: "0 0.2rem",
                  }}
                  title="Remove from blocklist"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
