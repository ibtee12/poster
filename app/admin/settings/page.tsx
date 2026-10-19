"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface SystemSettings {
  cleanDownloadCreditCost: number;
  poseGenerationCreditCost: number;
  freeSignupCredits: number;
  dailySpendingCapPerUser: number;
  aiKillSwitch: boolean;
}

interface PackageItem {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  active: boolean;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    cleanDownloadCreditCost: 0,
    poseGenerationCreditCost: 10,
    freeSignupCredits: 0,
    dailySpendingCapPerUser: 100,
    aiKillSwitch: false,
  });

  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New package form state
  const [newPkgName, setNewPkgName] = useState("");
  const [newPkgCredits, setNewPkgCredits] = useState("50");
  const [newPkgPrice, setNewPkgPrice] = useState("200");
  const [newPkgCurrency, setNewPkgCurrency] = useState("BDT");
  const [creatingPkg, setCreatingPkg] = useState(false);

  // Manual Credit adjustment state
  const [userEmail, setUserEmail] = useState("");
  const [creditAmount, setCreditAmount] = useState("20");
  const [creditReason, setCreditReason] = useState("Admin manual grant");
  const [adjustingCredits, setAdjustingCredits] = useState(false);
  const [userCurrentBal, setUserCurrentBal] = useState<number | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resSet, resPkg] = await Promise.all([
        fetch("/api/admin/settings"),
        fetch("/api/packages?all=true"),
      ]);

      if (resSet.ok) {
        const dataSet = await resSet.json();
        if (dataSet.settings) setSettings(dataSet.settings);
      }

      if (resPkg.ok) {
        const dataPkg = await resPkg.json();
        if (dataPkg.packages) setPackages(dataPkg.packages);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSavingSettings(true);
      setMsg(null);

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");

      setSettings(data.settings);
      setMsg({ type: "success", text: "Settings and pricing rules saved successfully!" });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to save settings" });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleKillSwitch = async () => {
    const nextVal = !settings.aiKillSwitch;
    setSettings((prev) => ({ ...prev, aiKillSwitch: nextVal }));

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiKillSwitch: nextVal }),
      });
      const data = await res.json();
      if (res.ok && data.settings) {
        setSettings(data.settings);
        setMsg({
          type: "success",
          text: nextVal
            ? "⚠️ AI Kill Switch is now ACTIVE. All AI pose generation is blocked immediately."
            : "✅ AI Kill Switch deactivated. AI pose generation is enabled.",
        });
      }
    } catch (err) {
      console.error("Failed to toggle kill switch", err);
    }
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreatingPkg(true);
      setMsg(null);

      const res = await fetch("/api/admin/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPkgName,
          credits: parseInt(newPkgCredits, 10),
          price: parseFloat(newPkgPrice),
          currency: newPkgCurrency,
          active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create package");

      setNewPkgName("");
      loadData();
      setMsg({ type: "success", text: `Package "${data.package.name}" created!` });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to create package" });
    } finally {
      setCreatingPkg(false);
    }
  };

  const handleTogglePackageActive = async (pkg: PackageItem) => {
    try {
      const res = await fetch(`/api/admin/packages/${pkg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !pkg.active }),
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error("Toggle package active failed", err);
    }
  };

  const handleDeletePackage = async (pkgId: string) => {
    if (!confirm("Are you sure you want to remove or deactivate this package?")) return;
    try {
      const res = await fetch(`/api/admin/packages/${pkgId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error("Delete package failed", err);
    }
  };

  const handleAdjustCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAdjustingCredits(true);
      setMsg(null);

      const res = await fetch("/api/admin/credits/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          amount: parseInt(creditAmount, 10),
          reason: creditReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Credit adjustment failed");

      setUserCurrentBal(data.newBalance);
      setMsg({
        type: "success",
        text: `Credits adjusted for ${data.email}. New balance: ${data.newBalance} credits.`,
      });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Credit adjustment failed" });
    } finally {
      setAdjustingCredits(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "30px 20px", fontFamily: "sans-serif" }}>
      {/* Admin Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e0e0e0", paddingBottom: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "1.6rem", fontWeight: 800 }}>Admin: Settings &amp; Pricing Rules</h1>
          <p style={{ margin: 0, color: "#666", fontSize: "0.95rem" }}>
            Configure credit pricing, AI pose cost, daily limits, kill switch, and packages.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin" style={{ padding: "8px 14px", border: "1px solid #ccc", borderRadius: 6, textDecoration: "none", color: "#333", fontSize: "0.9rem" }}>
            Templates
          </Link>
          <Link href="/admin/poses" style={{ padding: "8px 14px", border: "1px solid #ccc", borderRadius: 6, textDecoration: "none", color: "#333", fontSize: "0.9rem" }}>
            AI Poses
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
            fontSize: "0.95rem",
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Global AI Kill Switch Banner */}
      <div
        style={{
          border: `2px solid ${settings.aiKillSwitch ? "#d93025" : "#1e8e3e"}`,
          background: settings.aiKillSwitch ? "#fce8e6" : "#f6fbf7",
          padding: "20px 24px",
          borderRadius: 12,
          marginBottom: 32,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: "1.4rem" }}>{settings.aiKillSwitch ? "🛑" : "⚡"}</span>
            <h3 style={{ margin: 0, fontSize: "1.2rem", color: settings.aiKillSwitch ? "#d93025" : "#1e8e3e" }}>
              Global AI Kill Switch: {settings.aiKillSwitch ? "ACTIVATED (Blocked)" : "Deactivated (Active)"}
            </h3>
          </div>
          <p style={{ margin: 0, color: "#555", fontSize: "0.9rem" }}>
            Instantly turns off all AI generation across the entire platform. Useful for emergency cost spikes or outages.
          </p>
        </div>
        <button
          onClick={handleToggleKillSwitch}
          id="btn-ai-killswitch"
          style={{
            padding: "12px 24px",
            background: settings.aiKillSwitch ? "#1e8e3e" : "#d93025",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            cursor: "pointer",
            fontSize: "1rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          }}
        >
          {settings.aiKillSwitch ? "Re-enable AI Pose Generation" : "Emergency Kill AI Generation"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        {/* Pricing Rules Form */}
        <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: "1.2rem", margin: "0 0 16px 0", fontWeight: 700 }}>Credits &amp; Pricing Rules</h2>
          <form onSubmit={handleSaveSettings}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#333", marginBottom: 4 }}>
                Clean Download Credit Cost
              </label>
              <input
                type="number"
                min="0"
                value={settings.cleanDownloadCreditCost}
                onChange={(e) => setSettings({ ...settings, cleanDownloadCreditCost: parseInt(e.target.value) || 0 })}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" }}
              />
              <span style={{ fontSize: "0.8rem", color: "#666" }}>Default: 0 for free testing. Set &gt; 0 to charge credits per clean export.</span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#333", marginBottom: 4 }}>
                AI Pose Generation Cost (Credits)
              </label>
              <input
                type="number"
                min="0"
                value={settings.poseGenerationCreditCost}
                onChange={(e) => setSettings({ ...settings, poseGenerationCreditCost: parseInt(e.target.value) || 0 })}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" }}
              />
              <span style={{ fontSize: "0.8rem", color: "#666" }}>Credits deducted per pose generation request. Refunded automatically on failure.</span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#333", marginBottom: 4 }}>
                Free Signup Bonus Credits
              </label>
              <input
                type="number"
                min="0"
                value={settings.freeSignupCredits}
                onChange={(e) => setSettings({ ...settings, freeSignupCredits: parseInt(e.target.value) || 0 })}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" }}
              />
              <span style={{ fontSize: "0.8rem", color: "#666" }}>Default 0. Granted automatically when a new user registers.</span>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#333", marginBottom: 4 }}>
                Daily Spending Cap Per User (Credits)
              </label>
              <input
                type="number"
                min="1"
                value={settings.dailySpendingCapPerUser}
                onChange={(e) => setSettings({ ...settings, dailySpendingCapPerUser: parseInt(e.target.value) || 100 })}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" }}
              />
              <span style={{ fontSize: "0.8rem", color: "#666" }}>Maximum credits any single user can spend in a 24-hour period.</span>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              style={{
                background: "#0066cc",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: 6,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {savingSettings ? "Saving..." : "Save Pricing Rules"}
            </button>
          </form>
        </div>

        {/* Manual User Credit Adjustment */}
        <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: "1.2rem", margin: "0 0 16px 0", fontWeight: 700 }}>Manual User Credit Adjustment</h2>
          <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: 16 }}>
            Admins can manually add (+) or deduct (-) credits for any user.
          </p>

          <form onSubmit={handleAdjustCredits}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#333", marginBottom: 4 }}>
                User Email Address
              </label>
              <input
                type="email"
                required
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="user@example.com"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#333", marginBottom: 4 }}>
                Amount to Adjust (Positive to add, Negative to deduct)
              </label>
              <input
                type="number"
                required
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#333", marginBottom: 4 }}>
                Reason / Reference
              </label>
              <input
                type="text"
                required
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" }}
              />
            </div>

            <button
              type="submit"
              disabled={adjustingCredits}
              style={{
                background: "#137333",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: 6,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {adjustingCredits ? "Updating..." : "Execute Adjustment"}
            </button>
          </form>
        </div>
      </div>

      {/* Credit Packages Section */}
      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: "1.2rem", margin: "0 0 16px 0", fontWeight: 700 }}>Manage Credit Packages</h2>

        {/* Add Package Form */}
        <form onSubmit={handleCreatePackage} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 12, marginBottom: 24, alignItems: "end" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>Package Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Creator Pack"
              value={newPkgName}
              onChange={(e) => setNewPkgName(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>Credits</label>
            <input
              type="number"
              min="1"
              required
              value={newPkgCredits}
              onChange={(e) => setNewPkgCredits(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>Price</label>
            <input
              type="number"
              min="0"
              step="any"
              required
              value={newPkgPrice}
              onChange={(e) => setNewPkgPrice(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>Currency</label>
            <input
              type="text"
              required
              value={newPkgCurrency}
              onChange={(e) => setNewPkgCurrency(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={creatingPkg}
              style={{ background: "#0066cc", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}
            >
              + Add Package
            </button>
          </div>
        </form>

        {/* Existing Packages Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e0e0e0", textAlign: "left" }}>
              <th style={{ padding: "10px 12px" }}>Package Name</th>
              <th style={{ padding: "10px 12px" }}>Credits</th>
              <th style={{ padding: "10px 12px" }}>Price</th>
              <th style={{ padding: "10px 12px" }}>Status</th>
              <th style={{ padding: "10px 12px", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((pkg) => (
              <tr key={pkg.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "12px", fontWeight: 600 }}>{pkg.name}</td>
                <td style={{ padding: "12px", color: "#0066cc", fontWeight: 700 }}>+{pkg.credits}</td>
                <td style={{ padding: "12px", fontWeight: 600 }}>{pkg.price} {pkg.currency}</td>
                <td style={{ padding: "12px" }}>
                  <span style={{ padding: "4px 8px", borderRadius: 4, fontSize: "0.8rem", fontWeight: 600, background: pkg.active ? "#e6f4ea" : "#f1f3f4", color: pkg.active ? "#137333" : "#666" }}>
                    {pkg.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ padding: "12px", textAlign: "right" }}>
                  <button
                    onClick={() => handleTogglePackageActive(pkg)}
                    style={{ marginRight: 8, padding: "4px 8px", background: "#f1f3f4", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer", fontSize: "0.85rem" }}
                  >
                    {pkg.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDeletePackage(pkg.id)}
                    style={{ padding: "4px 8px", background: "#ffebee", border: "1px solid #ffcdd2", color: "#c62828", borderRadius: 4, cursor: "pointer", fontSize: "0.85rem" }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
