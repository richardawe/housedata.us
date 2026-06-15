import type { Metadata } from "next";
import Link from "next/link";
import ProtestCalendar from "@/components/ProtestCalendar";

export const metadata: Metadata = {
  title: "Protest Calendar — HouseData",
  description:
    "Filing windows and deadlines for property tax protests across all states. See when you can protest your assessment in Texas, California, Florida, New York, and more.",
};

export default function CalendarPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← Back
          </Link>
          <h1 className="text-4xl font-bold tracking-tight mt-3">
            Protest Calendar
          </h1>
          <p className="text-lg text-gray-500 mt-2">
            Filing windows and deadlines for property tax protests across all
            states. Click any date to see events; switch to List view for a
            chronological overview.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <ProtestCalendar />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Disclaimer:</strong> Protest deadlines are set by state law
          and may vary by county or change year to year. Always confirm dates
          with your local appraisal district or county assessor before filing.
          This calendar is for informational purposes only.
        </div>
      </div>
    </main>
  );
}
