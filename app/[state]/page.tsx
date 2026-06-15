"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import AddressSearch from "@/components/AddressSearch";
import { use } from "react";

const TexasMap = dynamic(() => import("@/components/TexasMap"), { ssr: false });

interface Props {
  params: Promise<{ state: string }>;
}

// Map state subdomain → county slug shown on the map landing
const STATE_LAUNCH_COUNTY: Record<string, string> = {
  texas: "travis-tx",
};

export default function StatePage({ params }: Props) {
  const { state } = use(params);
  const launchCounty = STATE_LAUNCH_COUNTY[state] ?? "";

  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  function handleTravisClick() {
    setShowSearch(true);
    setTimeout(() => {
      searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      searchRef.current?.querySelector("input")?.focus();
    }, 50);
  }

  if (state === "texas") {
    return (
      <main className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight mb-3">Texas Property Tax Appeal</h1>
            <p className="text-lg text-gray-500">
              Select your county to check how your assessment compares to similar homes.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <TexasMap onTravisClick={handleTravisClick} />
          </div>

          {showSearch && (
            <div ref={searchRef} className="bg-white rounded-2xl border border-blue-200 p-6 shadow-md">
              <h2 className="text-xl font-semibold mb-1">Travis County, TX</h2>
              <p className="text-sm text-gray-500 mb-4">2025 appraisal roll · Enter your address below</p>
              <AddressSearch state={state} countySlug={launchCounty} />
            </div>
          )}
        </div>
      </main>
    );
  }

  // Generic state landing for future states
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight capitalize">
          {state.replace(/-/g, " ")} Property Tax Appeal
        </h1>
        <p className="text-gray-500">County data for this state is coming soon.</p>
      </div>
    </main>
  );
}
