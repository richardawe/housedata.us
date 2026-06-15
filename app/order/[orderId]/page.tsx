"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface OrderStatus {
  status: "pending" | "paid" | "delivered" | "refunded" | "error";
  address?: string;
  accountId?: string;
}

export default function OrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!orderId) return;

    // Handle {CHECKOUT_SESSION_ID} placeholder from Stripe success_url
    if (orderId.startsWith("cs_")) {
      // Redirect to resolve session → order id
      fetch(`/api/order-by-session?session=${orderId}`)
        .then((r) => r.json())
        .then((d) => d.orderId && (window.location.href = `/order/${d.orderId}`))
        .catch(() => setOrder({ status: "error" }));
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/order-status/${orderId}`);
        const data = await res.json();
        setOrder(data);
        if (data.status === "delivered") setPolling(false);
      } catch {
        setOrder({ status: "error" });
        setPolling(false);
      }
    };

    poll();
    if (!polling) return;
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [orderId, polling]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-5">
        {!order && (
          <p className="text-gray-500 text-lg">Loading your order…</p>
        )}

        {order?.status === "pending" || order?.status === "paid" ? (
          <>
            <div className="text-5xl">⏳</div>
            <h1 className="text-2xl font-bold">Generating your packet…</h1>
            <p className="text-gray-500">
              This usually takes under a minute. This page will update automatically.
            </p>
          </>
        ) : null}

        {order?.status === "delivered" && (
          <>
            <div className="text-5xl">✅</div>
            <h1 className="text-2xl font-bold">Your evidence packet is ready</h1>
            {order.address && <p className="text-gray-600">{order.address}</p>}
            <a
              href={`/api/download/${orderId}`}
              className="block w-full bg-blue-600 text-white font-semibold py-4 rounded-xl text-lg hover:bg-blue-700 transition"
            >
              Download PDF packet
            </a>
            <p className="text-sm text-gray-400">
              Save this URL — you can return here to download again at any time.
            </p>
          </>
        )}

        {order?.status === "refunded" && (
          <>
            <h1 className="text-2xl font-bold">Order refunded</h1>
            <p className="text-gray-500">This order has been refunded. No packet is available.</p>
          </>
        )}

        {order?.status === "error" && (
          <>
            <h1 className="text-2xl font-bold text-red-600">Something went wrong</h1>
            <p className="text-gray-500">
              Please contact us and include your order ID: <code>{orderId}</code>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
