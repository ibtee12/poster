"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface PoseItem {
  id: string;
  name: string;
  category: string;
  previewImagePath: string;
  referenceImagePath: string;
  active: boolean;
  createdAt: string;
}

export default function AdminPosesPage() {
  const [poses, setPoses] = useState<PoseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Pose Form
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Leadership");
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [refFile, setRefFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const previewInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const loadPoses = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/poses?all=true");
      if (res.ok) {
        const data = await res.json();
        if (data.poses) setPoses(data.poses);
      }
    } catch (err) {
      console.error("Failed to load poses:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPoses();
  }, []);

  const handleCreatePose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSubmitting(true);
      setMsg(null);

      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("category", category.trim());

      if (previewFile) {
        formData.append("preview", previewFile);
      }
      if (refFile) {
        formData.append("reference", refFile);
      }

      const res = await fetch("/api/poses", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create pose");

      setName("");
      setPreviewFile(null);
      setRefFile(null);
      if (previewInputRef.current) previewInputRef.current.value = "";
      if (refInputRef.current) refInputRef.current.value = "";

      loadPoses();
      setMsg({ type: "success", text: `Pose "${data.pose.name}" created successfully!` });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to create pose" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (pose: PoseItem) => {
    try {
      const res = await fetch(`/api/poses/${pose.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !pose.active }),
      });
      if (res.ok) loadPoses();
    } catch (err) {
      console.error("Toggle pose failed", err);
    }
  };

  const handleDeletePose = async (id: string) => {
    if (!confirm("Are you sure you want to delete this pose?")) return;
    try {
      const res = await fetch(`/api/poses/${id}`, { method: "DELETE" });
      if (res.ok) loadPoses();
    } catch (err) {
      console.error("Delete pose failed", err);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "30px 20px", fontFamily: "sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e0e0e0", paddingBottom: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "1.6rem", fontWeight: 800 }}>Admin: AI Pose References</h1>
          <p style={{ margin: 0, color: "#666", fontSize: "0.95rem" }}>
            Upload and manage reference poses (hands up, standing, waving) for template image slots.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin" style={{ padding: "8px 14px", border: "1px solid #ccc", borderRadius: 6, textDecoration: "none", color: "#333", fontSize: "0.9rem" }}>
            Templates
          </Link>
          <Link href="/admin/settings" style={{ padding: "8px 14px", border: "1px solid #ccc", borderRadius: 6, textDecoration: "none", color: "#333", fontSize: "0.9rem" }}>
            Settings &amp; Credits
          </Link>
          <Link href="/admin/payments" style={{ padding: "8px 14px", border: "1px solid #ccc", borderRadius: 6, textDecoration: "none", color: "#333", fontSize: "0.9rem" }}>
            Payments
          </Link>
        </div>
      </div>

      {msg && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 24,
            background: msg.type === "success" ? "#e6f4ea" : "#fce8e6",
            color: msg.type === "success" ? "#137333" : "#c5221f",
            fontWeight: 600,
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Upload New Pose Card */}
      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 24, marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.2rem", margin: "0 0 16px 0", fontWeight: 700 }}>+ Add New AI Reference Pose</h2>
        <form onSubmit={handleCreatePose} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr auto", gap: 16, alignItems: "end" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>Pose Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Hands Up / Waving / Standing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>Category</label>
            <input
              type="text"
              required
              placeholder="e.g. Speech, Leadership"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>Preview Thumbnail</label>
            <input
              ref={previewInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setPreviewFile(e.target.files?.[0] || null)}
              style={{ fontSize: "0.8rem" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>Reference Image</label>
            <input
              ref={refInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setRefFile(e.target.files?.[0] || null)}
              style={{ fontSize: "0.8rem" }}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: "#0066cc",
                color: "#fff",
                border: "none",
                padding: "10px 18px",
                borderRadius: 6,
                fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Uploading..." : "Save Pose"}
            </button>
          </div>
        </form>
      </div>

      {/* Existing Poses Grid */}
      <h2 style={{ fontSize: "1.2rem", margin: "0 0 16px 0", fontWeight: 700 }}>Available Poses ({poses.length})</h2>

      {poses.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, background: "#f8f9fa", borderRadius: 8, color: "#666" }}>
          <p>No reference poses created yet. Use the form above to add poses.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
          {poses.map((pose) => (
            <div
              key={pose.id}
              style={{
                background: "#fff",
                border: "1px solid #e0e0e0",
                borderRadius: 10,
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ height: 180, background: "#f0f2f5", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {pose.previewImagePath ? (
                  <img
                    src={pose.previewImagePath}
                    alt={pose.name}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <span style={{ color: "#999", fontSize: "0.9rem" }}>No thumbnail</span>
                )}
              </div>

              <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>{pose.name}</h3>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: pose.active ? "#e6f4ea" : "#f1f3f4",
                        color: pose.active ? "#137333" : "#666",
                      }}
                    >
                      {pose.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "#666", background: "#f1f3f4", padding: "2px 6px", borderRadius: 4 }}>
                    {pose.category}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, borderTop: "1px solid #f0f0f0", paddingTop: 10 }}>
                  <button
                    onClick={() => handleToggleActive(pose)}
                    style={{ background: "none", border: "1px solid #ccc", padding: "4px 8px", borderRadius: 4, fontSize: "0.8rem", cursor: "pointer" }}
                  >
                    {pose.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDeletePose(pose.id)}
                    style={{ background: "none", border: "1px solid #ffcdd2", color: "#c62828", padding: "4px 8px", borderRadius: 4, fontSize: "0.8rem", cursor: "pointer" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
