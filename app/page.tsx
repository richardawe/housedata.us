"use client";

import { useMemo } from "react";
import { getProtestEvents } from "@/lib/protest-calendar";

const STATES = [
  { name: "Texas",          subdomain: "texas",          available: true  },
  { name: "California",     subdomain: "california",     available: false },
  { name: "Florida",        subdomain: "florida",        available: false },
  { name: "New York",       subdomain: "new-york",       available: false },
  { name: "Illinois",       subdomain: "illinois",       available: false },
  { name: "Georgia",        subdomain: "georgia",        available: false },
  { name: "North Carolina", subdomain: "north-carolina", available: false },
  { name: "Arizona",        subdomain: "arizona",        available: false },
];

function getStateUrl(subdomain: string): string {
  return `/${subdomain}`;
}

function todayISO(): string {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

export default function Home() {
  const today = todayISO();
  const year  = parseInt(today.slice(0, 4), 10);

  const upcomingDeadlines = useMemo(() => {
    const all = getProtestEvents([year, year + 1]);
    return all
      .filter((e) => e.endDate >= today && e.type === "deadline")
      .slice(0, 3);
  }, [today, year]);

  return (
    <main className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-2xl mx-auto space-y-10">

        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Is your home over-assessed?
          </h1>
          <p className="text-xl text-gray-500">
            We analyze every residential parcel against comparable homes so you
            know whether you have a case — free, instant, and backed by public
            appraisal data.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Select your state
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {STATES.map((s) =>
              s.available ? (
                <a
                  key={s.subdomain}
                  href={getStateUrl(s.subdomain)}
                  className="flex items-center justify-between bg-white border border-blue-200 rounded-xl px-5 py-4 shadow-sm hover:shadow-md hover:border-blue-400 transition group"
                >
                  <span className="font-semibold text-gray-900 group-hover:text-blue-700">
                    {s.name}
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    Live
                  </span>
                </a>
              ) : (
                <div
                  key={s.subdomain}
                  className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-5 py-4 opacity-60 cursor-default"
                >
                  <span className="font-semibold text-gray-500">{s.name}</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                    Coming soon
                  </span>
                </div>
              )
            )}
          </div>
        </div>

        {/* Upcoming deadlines teaser */}
        {upcomingDeadlines.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Upcoming protest deadlines</h2>
              <a href="/calendar" className="text-sm text-blue-600 hover:underline">
                Full calendar →
              </a>
            </div>
            <ul className="space-y-2">
              {upcomingDeadlines.map((e) => {
                const [, sm, sd] = e.startDate.split("-").map(Number);
                const months = [
                  "Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec",
                ];
                return (
                  <li key={e.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{e.title}</span>
                    <span className="text-gray-400 font-medium whitespace-nowrap ml-3">
                      {months[sm - 1]} {sd}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex justify-center">
          <a
            href="/calendar"
            className="text-sm text-blue-600 hover:underline"
          >
            View protest deadlines for all states →
          </a>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Free to check · Public appraisal data only · Not affiliated with any
          appraisal district
        </p>
      </div>
    </main>
  );
}
