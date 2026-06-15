"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// Redirects to Stripe Checkout immediately on mount.
export default function CheckoutRedirect() {
  const { parcelId } = useParams<{ parcelId: string }>();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parcelId }),
        });
        const text = await res.text();
        const { url, error } = text ? JSON.parse(text) : {};
        if (url) {
          window.location.href = url;
        } else {
          console.error("Checkout error:", error);
          router.push("/");
        }
      } catch (e) {
        console.error("Checkout failed:", e);
        router.push("/");
      }
    })();
  }, [parcelId, router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Redirecting to checkout…</p>
    </main>
  );
}
