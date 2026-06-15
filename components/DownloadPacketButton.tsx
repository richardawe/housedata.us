"use client";

import { useState } from "react";

interface Props {
  county: string;
  accountId: string;
}

export default function DownloadPacketButton({ county, accountId }: Props) {
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/packet/${county}/${accountId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerName }),
      });
      if (!res.ok) throw new Error("Generation failed — try again.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `protest-packet-${accountId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={ownerName}
        onChange={(e) => setOwnerName(e.target.value)}
        placeholder="Your name as it appears on the deed (optional)"
        className="w-full bg-white text-gray-900 placeholder-gray-400 border border-blue-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white"
      />
      <button
        onClick={download}
        disabled={loading}
        className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
      >
        {loading ? "Generating PDF…" : "Download evidence packet — free"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
