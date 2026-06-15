"use client";

import { useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import AddressSearch from "@/components/AddressSearch";
import { use } from "react";
import {
  getUpcomingForState,
  todayISO,
  MONTH_NAMES,
} from "@/lib/protest-calendar";
import { subdomainToStateCode } from "@/lib/states";

const TexasMap = dynamic(() => import("@/components/TexasMap"), { ssr: false });

interface Props {
  params: Promise<{ state: string }>;
}

// Map state subdomain → county slug shown on the map landing
const STATE_LAUNCH_COUNTY: Record<string, string> = {
  texas: "travis-tx",
};

function DeadlineBanner({ stateCode }: { stateCode: string }) {
  const today = todayISO();

  const upcoming = useMemo(
    () => getUpcomingForState(stateCode, 2, ["deadline", "filing-window"]),
    [stateCode],
  );

  if (!upcoming.length) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-amber-900">Upcoming deadlines</h2>
        <a href="/calendar" className="text-xs text-blue-600 hover:underline">
          Full calendar →
        </a>
      </div>
      <ul className="space-y-1.5">
        {upcoming.map((e) => {
          const [, sm, sd] = e.startDate.split("-").map(Number);
          const isActive = e.startDate <= today && e.endDate >= today;
          return (
            <li key={e.id} className="flex items-center justify-between text-sm">
              <span className="text-amber-800">
                {e.title}
                {e.county && <span className="text-amber-600"> · {e.county}</span>}
              </span>
              <span className={`font-medium whitespace-nowrap ml-3 ${isActive ? "text-emerald-600" : "text-amber-700"}`}>
                {isActive ? "Active now" : `${MONTH_NAMES[sm - 1].slice(0, 3)} ${sd}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function StatePage({ params }: Props) {
  const { state } = use(params);
  const launchCounty = STATE_LAUNCH_COUNTY[state] ?? "";
  const stateCode    = subdomainToStateCode(state);

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
            <h1 className="text-4xl font-bold tracking-tight mb-3">
              Texas Property Tax Appeal
            </h1>
            <p className="text-lg text-gray-500">
              Select your county to check how your assessment compares to similar
              homes.
            </p>
          </div>

          <DeadlineBanner stateCode={stateCode} />

          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <TexasMap onTravisClick={handleTravisClick} />
          </div>

          {showSearch && (
            <div
              ref={searchRef}
              className="bg-white rounded-2xl border border-blue-200 p-6 shadow-md"
            >
              <h2 className="text-xl font-semibold mb-1">Travis County, TX</h2>
              <p className="text-sm text-gray-500 mb-4">
                2025 appraisal roll · Enter your address below
              </p>
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
      <div className="max-w-2xl mx-auto space-y-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight capitalize">
          {state.replace(/-/g, " ")} Property Tax Appeal
        </h1>
        <p className="text-gray-500">County data for this state is coming soon.</p>
        {stateCode && <DeadlineBanner stateCode={stateCode} />}
        <a href="/calendar" className="inline-block text-sm text-blue-600 hover:underline">
          View {state.replace(/-/g, " ")} protest deadlines on the calendar →
        </a>
      </div>
    </main>
  );
}
