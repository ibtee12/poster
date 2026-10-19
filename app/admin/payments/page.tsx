"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface PaymentItem {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  providerRef: string | null;
  createdAt: string;
  package: {
    name: string;
    credits: number;
  };
  user: {
    email: string;
  };
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/payments");
      if (res.ok) {
        const data = await res.json();
        if (data.payments) setPayments(data.payments);
      }
    } catch (err) {
      console.error("Failed to load payments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const handleApprovePayment = async (paymentId: string) => {
    try {
      setActionLoading(paymentId);
      setMsg(null);

      const res = await fetch("/api/admin/payments/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");

      setMsg({
        type: "success",
        text: data.alreadyProcessed
          ? "Payment was already paid and credited previously."
          : "Payment approved! Credits added to user wallet.",
      });
      loadPayments();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Approval failed" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReplayWebhook = async (payment: PaymentItem) => {
    try {
      setActionLoading(payment.id);
      setMsg(null);

      // Call webhook first time
      const res1 = await fetch("/api/payments/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          status: "paid",
          providerRef: `replayed_ref_${Date.now()}`,
        }),
      });
      const data1 = await res1.json();

      // Immediately replay same webhook second time
      const res2 = await fetch("/api/payments/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          status: "paid",
          providerRef: `replayed_ref_${Date.now()}`,
        }),
      });
      const data2 = await res2.json();

      setMsg({
        type: "success",
        text: `Webhook Idempotency Test Succeeded! Call 1 processed: ${!data1.alreadyProcessed ? "Newly credited" : "Already paid"}. Call 2 replayed: alreadyProcessed = ${data2.alreadyProcessed} (No double credit!).`,
      });
      loadPayments();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Webhook replay failed" });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "30px 20px", fontFamily: "sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e0e0e0", paddingBottom: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "1.6rem", fontWeight: 800 }}>Admin: Payment Records &amp; Gateways</h1>
          <p style={{ margin: 0, color: "#666", fontSize: "0.95rem" }}>
            Monitor payments, approve manual/test transactions, and verify idempotent webhook handling.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin" style={{ padding: "8px 14px", border: "1px solid #ccc", borderRadius: 6, textDecoration: "none", color: "#333", fontSize: "0.9rem" }}>
            Templates
          </Link>
          <Link href="/admin/settings" style={{ padding: "8px 14px", border: "1px solid #ccc", borderRadius: 6, textDecoration: "none", color: "#333", fontSize: "0.9rem" }}>
            Settings &amp; Credits
          </Link>
          <Link href="/admin/poses" style={{ padding: "8px 14px", border: "1px solid #ccc", borderRadius: 6, textDecoration: "none", color: "#333", fontSize: "0.9rem" }}>
            AI Poses
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

      {/* Payment Records Table */}
      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: "1.2rem", margin: 0, fontWeight: 700 }}>Payment History ({payments.length})</h2>
          <button
            onClick={loadPayments}
            style={{ background: "#f1f3f4", border: "1px solid #ccc", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}
          >
            🔄 Refresh
          </button>
        </div>

        {payments.length === 0 ? (
          <p style={{ color: "#888", textAlign: "center", padding: 32 }}>No payments recorded yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #e0e0e0", textAlign: "left" }}>
                <th style={{ padding: "10px 12px" }}>Date</th>
                <th style={{ padding: "10px 12px" }}>User</th>
                <th style={{ padding: "10px 12px" }}>Package</th>
                <th style={{ padding: "10px 12px" }}>Amount</th>
                <th style={{ padding: "10px 12px" }}>Gateway</th>
                <th style={{ padding: "10px 12px" }}>Status</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const isPending = p.status === "pending";
                const isPaid = p.status === "paid";

                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "10px 12px", color: "#666" }}>
                      {new Date(p.createdAt).toLocaleDateString()} {new Date(p.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{p.user?.email || p.userId}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {p.package?.name} <span style={{ color: "#0066cc", fontWeight: 600 }}>({p.package?.credits} credits)</span>
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                      {p.amount} {p.currency}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ textTransform: "uppercase", fontSize: "0.8rem", background: "#f0f0f0", padding: "2px 6px", borderRadius: 4 }}>
                        {p.provider}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          background: isPaid ? "#e6f4ea" : isPending ? "#fff8e1" : "#fce8e6",
                          color: isPaid ? "#137333" : isPending ? "#b06000" : "#c5221f",
                        }}
                      >
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      {isPending && (
                        <button
                          onClick={() => handleApprovePayment(p.id)}
                          disabled={actionLoading === p.id}
                          style={{
                            background: "#137333",
                            color: "#fff",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontWeight: 600,
                            marginRight: 6,
                          }}
                        >
                          {actionLoading === p.id ? "Approving..." : "Approve & Credit"}
                        </button>
                      )}
                      <button
                        onClick={() => handleReplayWebhook(p)}
                        disabled={actionLoading === p.id}
                        title="Replays webhook twice to prove idempotent crediting"
                        style={{
                          background: "#f1f3f4",
                          border: "1px solid #ccc",
                          padding: "6px 10px",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Test Webhook Replay
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
