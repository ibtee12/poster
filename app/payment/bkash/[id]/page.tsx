"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface PaymentData {
  id: string;
  amount: number;
  currency: string;
  status: string;
  package: {
    name: string;
    credits: number;
    price: number;
  };
}

export default function BkashCheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const paymentId = params?.id as string;

  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [bkashNumber, setBkashNumber] = useState("01700000000");

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
      .catch(() => setError("Failed to load payment details"))
      .finally(() => setLoading(false));
  }, [paymentId]);

  const handlePayWithBkash = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId,
          extraParams: {
            bkashPaymentID: `BKASH_TRX_${Date.now()}`,
            senderNumber: bkashNumber,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "bKash payment failed");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Payment failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "sans-serif" }}>
        <p>Connecting to bKash Gateway...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 460, margin: "60px auto", padding: "32px 24px", fontFamily: "sans-serif", background: "#fff", border: "1px solid #e2136e", borderRadius: 12, boxShadow: "0 4px 20px rgba(226,19,110,0.12)" }}>
      <div style={{ textAlign: "center", borderBottom: "2px solid #e2136e", paddingBottom: 16, marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: "#e2136e", fontSize: "1.4rem", fontWeight: 800 }}>bKash Tokenized Checkout</h2>
        <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#666" }}>Official Merchant Payment Simulator</p>
      </div>

      {payment && (
        <div style={{ background: "#fdf0f5", padding: 16, borderRadius: 8, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "#555", fontSize: "0.9rem" }}>Package:</span>
            <span style={{ fontWeight: 600 }}>{payment.package?.name}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "#555", fontSize: "0.9rem" }}>Credits:</span>
            <span style={{ fontWeight: 700, color: "#e2136e" }}>+{payment.package?.credits} Credits</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#555", fontSize: "0.9rem" }}>Amount:</span>
            <span style={{ fontWeight: 800, fontSize: "1.2rem", color: "#e2136e" }}>৳ {payment.amount}</span>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: "#ffebee", color: "#c62828", padding: 12, borderRadius: 6, marginBottom: 20, fontSize: "0.9rem" }}>
          {error}
        </div>
      )}

      {success ? (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e6f4ea", color: "#137333", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", marginBottom: 12 }}>
            ✓
          </div>
          <h3 style={{ margin: "0 0 8px 0", color: "#137333" }}>bKash Payment Completed!</h3>
          <p style={{ color: "#555", margin: "0 0 16px 0", fontSize: "0.95rem" }}>
            ৳{payment?.amount} was charged. {payment?.package?.credits} credits have been added to your wallet.
          </p>
          <button
            onClick={() => router.back()}
            style={{ background: "#e2136e", color: "#fff", border: "none", padding: "10px 24px", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}
          >
            Continue
          </button>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 6, color: "#333" }}>bKash Account Number</label>
            <input
              type="text"
              value={bkashNumber}
              onChange={(e) => setBkashNumber(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: 6, fontSize: "1rem", boxSizing: "border-box" }}
              placeholder="01XXXXXXXXX"
            />
          </div>
          <button
            onClick={handlePayWithBkash}
            disabled={submitting}
            style={{
              width: "100%",
              background: submitting ? "#999" : "#e2136e",
              color: "#fff",
              border: "none",
              padding: "14px 20px",
              borderRadius: 8,
              fontSize: "1.05rem",
              fontWeight: 800,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Processing with bKash..." : `Pay ৳ ${payment?.amount}`}
          </button>
        </div>
      )}
    </div>
  );
}
