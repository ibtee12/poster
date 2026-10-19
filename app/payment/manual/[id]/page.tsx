"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface PaymentData {
  id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  package: {
    name: string;
    credits: number;
    price: number;
  };
  user: {
    email: string;
  };
}

export default function ManualPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const paymentId = params?.id as string;

  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [newBalance, setNewBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!paymentId) return;

    fetch(`/api/payments/${paymentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.payment) {
          setPayment(data.payment);
          if (data.payment.status === "paid") {
            setSuccess(true);
          }
        } else {
          setError(data.error || "Payment not found");
        }
      })
      .catch((err) => setError("Failed to load payment details"))
      .finally(() => setLoading(false));
  }, [paymentId]);

  const handleSimulatePayment = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId,
          extraParams: { providerRef: `manual_test_trx_${Date.now()}` },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Payment verification failed");
      }

      setSuccess(true);
      setNewBalance(data.balance);
    } catch (err: any) {
      setError(err.message || "Failed to process test payment");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "sans-serif" }}>
        <p>Loading payment checkout...</p>
      </div>
    );
  }

  if (error && !payment) {
    return (
      <div style={{ maxWidth: 500, margin: "60px auto", padding: 24, textAlign: "center", fontFamily: "sans-serif" }}>
        <h2 style={{ color: "#d9534f" }}>Payment Error</h2>
        <p>{error}</p>
        <Link href="/" style={{ color: "#0066cc", textDecoration: "underline" }}>Return Home</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: "60px auto", padding: "32px 24px", fontFamily: "sans-serif", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #eee", paddingBottom: 16, marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>Test / Manual Payment</h2>
        <span style={{ fontSize: "0.85rem", padding: "4px 8px", borderRadius: 6, background: success ? "#e6f4ea" : "#fff8e1", color: success ? "#137333" : "#b06000", fontWeight: 600 }}>
          {success ? "PAID" : "PENDING"}
        </span>
      </div>

      {payment && (
        <div style={{ background: "#f8f9fa", padding: 16, borderRadius: 8, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#666", fontSize: "0.95rem" }}>Package:</span>
            <span style={{ fontWeight: 600 }}>{payment.package?.name}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#666", fontSize: "0.95rem" }}>Credits:</span>
            <span style={{ fontWeight: 600, color: "#0066cc" }}>+{payment.package?.credits} Credits</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#666", fontSize: "0.95rem" }}>Amount:</span>
            <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>{payment.amount} {payment.currency}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#888" }}>
            <span>Payment ID:</span>
            <span>{payment.id}</span>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: "#ffebee", color: "#c62828", padding: 12, borderRadius: 6, marginBottom: 20, fontSize: "0.9rem" }}>
          {error}
        </div>
      )}

      {success ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e6f4ea", color: "#137333", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", marginBottom: 16 }}>
            ✓
          </div>
          <h3 style={{ margin: "0 0 8px 0", color: "#137333" }}>Payment Confirmed!</h3>
          <p style={{ color: "#555", margin: "0 0 16px 0", fontSize: "0.95rem" }}>
            {payment?.package?.credits} credits have been successfully added to your wallet.
            {newBalance !== null && <strong> (Current balance: {newBalance} credits)</strong>}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={() => router.back()}
              style={{ background: "#0066cc", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}
            >
              Continue Making Poster
            </button>
            <Link
              href="/"
              style={{ background: "#f1f3f4", color: "#333", textDecoration: "none", padding: "10px 20px", borderRadius: 6, fontWeight: 600 }}
            >
              Home
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: "0.9rem", color: "#666", lineHeight: 1.5, marginBottom: 20 }}>
            This is the Test Payment Gateway. In production, this can also be approved manually by an admin from the admin dashboard.
          </p>
          <button
            onClick={handleSimulatePayment}
            disabled={submitting}
            style={{
              width: "100%",
              background: submitting ? "#999" : "#137333",
              color: "#fff",
              border: "none",
              padding: "14px 20px",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {submitting ? "Confirming Payment..." : `Pay ${payment?.amount} ${payment?.currency} (Simulate Success)`}
          </button>
        </div>
      )}
    </div>
  );
}
