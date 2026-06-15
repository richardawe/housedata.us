import { notFound } from "next/navigation";
import Link from "next/link";
import { getParcelWithAnalysis, getCompRows } from "@/lib/db/queries";
import { usd, pct, num } from "@/lib/format";
import { DEADLINE_PASSED } from "@/lib/config";
import DownloadPacketButton from "@/components/DownloadPacketButton";

export const revalidate = 60;

interface Props {
  params: Promise<{ state: string; county: string; account_id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { county, account_id } = await params;
  const parcel = await getParcelWithAnalysis(county, account_id);
  if (!parcel) return { title: "Property not found" };
  return {
    title: `${parcel.situs_address} — HouseData`,
    description: parcel.pct_above
      ? `This property is assessed ~${pct(parcel.pct_above)} above comparable homes.`
      : "See how this property compares to similar homes nearby.",
  };
}

export default async function ResultPage({ params }: Props) {
  const { state, county, account_id } = await params;
  const parcel = await getParcelWithAnalysis(county, account_id);
  if (!parcel) notFound();

  const hasAnalysis = parcel.comp_count != null && parcel.comp_count > 0;
  const teaserComps = hasAnalysis && parcel.comp_ids
    ? await getCompRows(parcel.comp_ids.slice(0, 3).map(String))
    : [];

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <Link href={`/${state}`} className="text-sm text-blue-600 hover:underline">← Search another address</Link>
          <h1 className="text-2xl font-bold mt-2">{parcel.situs_address}</h1>
          <p className="text-gray-500 text-sm">
            {parcel.situs_city}{parcel.situs_zip ? `, TX ${parcel.situs_zip}` : ""}
            {" · "}
            <span className="font-medium">{parcel.tax_year} appraisal</span>
          </p>
        </div>

        {/* Confidence flag */}
        {hasAnalysis && parcel.comp_quality !== "strict" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
            Based on relaxed comp criteria ({parcel.comp_quality?.replace("_", " ")}) — fewer nearby comparable homes were available.
          </div>
        )}

        {/* Main result card */}
        {hasAnalysis ? (
          <ResultCard parcel={parcel} />
        ) : parcel.living_sqft && parcel.market_value ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <ValueBox label="Market value" value={parcel.market_value ? usd(parcel.market_value) : "—"} />
              <ValueBox label="Taxable value" value={parcel.assessed_value ? usd(parcel.assessed_value) : "—"} />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 text-center">
              Analysis in progress — check back shortly.
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500">
            We couldn&apos;t automatically analyze this property — it may be missing
            square footage or value data. Contact the appraisal district for details.
          </div>
        )}

        {/* Comp teaser */}
        {teaserComps.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold mb-3">Sample comparable homes</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b">
                  <th className="pb-2 font-medium">Address</th>
                  <th className="pb-2 font-medium text-right">$/sqft</th>
                </tr>
              </thead>
              <tbody>
                {teaserComps.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 text-gray-700">{truncateAddress(c.situs_address)}</td>
                    <td className="py-2 text-right font-mono">
                      {c.psf ? `$${num(c.psf)}` : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="text-gray-400 italic">
                  <td colSpan={2} className="py-2 text-sm">
                    + {(parcel.comp_count ?? 0) - 3} more comps in the full report
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Download packet */}
        {hasAnalysis && !DEADLINE_PASSED && (
          <div className="bg-blue-600 text-white rounded-xl p-6">
            <h2 className="text-xl font-bold mb-1">Get the full evidence packet — free</h2>
            <ul className="text-blue-100 text-sm space-y-1 mb-4">
              <li>✓ Full equity comps table (ready to hand to the ARB)</li>
              <li>✓ Pre-filled Form 50-132 (Texas Notice of Protest)</li>
              <li>✓ Step-by-step filing instructions + hearing script</li>
              <li>✓ Instant PDF download, no account required</li>
            </ul>
            <DownloadPacketButton county={county} accountId={parcel.account_id} />
          </div>
        )}
        {DEADLINE_PASSED && (
          <div className="bg-gray-100 rounded-xl p-5 text-center text-sm text-gray-600">
            The protest deadline has passed for this year. Save this page and check back in March for next year&apos;s analysis.
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-gray-400 text-center">
          Estimates based on {parcel.tax_year} appraisal roll data (public record).
          Not legal, tax, or financial advice. Not affiliated with any appraisal district.
        </p>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ResultCard({ parcel }: { parcel: Awaited<ReturnType<typeof getParcelWithAnalysis>> }) {
  if (!parcel) return null;
  const { savings_case, pct_above, annual_savings, implied_value, market_value, assessed_value, comp_count } = parcel;

  const headline =
    pct_above != null && pct_above > 0
      ? `Assessed ~${pct(pct_above)} above comparable homes`
      : pct_above != null && pct_above < 0
      ? `Assessed ~${pct(Math.abs(pct_above))} below comparable homes`
      : "Assessment looks in line with comparable homes";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <p className="text-3xl font-bold text-blue-700">{headline}</p>
        <p className="text-sm text-gray-500 mt-1">Based on {comp_count} comparable homes</p>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-2 border-t text-sm">
        <ValueBox label="Market value" value={market_value ? usd(market_value) : "—"} />
        <ValueBox label="Taxable value" value={assessed_value ? usd(assessed_value) : "—"} />
        <ValueBox label="Implied value" value={implied_value ? usd(implied_value) : "—"} />
      </div>

      {savings_case === "clear" && annual_savings != null && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="text-green-800 font-semibold text-lg">
            Estimated savings: {usd(annual_savings)}/yr
          </p>
          <p className="text-green-700 text-sm mt-1">
            If successful, your protest could reduce this year&apos;s tax bill by approximately {usd(annual_savings)}.
          </p>
        </div>
      )}

      {savings_case === "partial" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-amber-800 font-semibold">Homestead cap is currently protecting your tax bill</p>
          <p className="text-amber-700 text-sm mt-1">
            Your taxable value ({assessed_value ? usd(assessed_value) : "—"}) is already below the implied value of
            comparable homes. Protesting will lower your market value and reduce future assessment ceilings,
            but won&apos;t change this year&apos;s bill directly.
          </p>
        </div>
      )}

      {savings_case === "capped" && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          <p className="text-gray-700 font-semibold">Your taxable value is protected by the homestead cap</p>
          <p className="text-gray-600 text-sm mt-1">
            Your taxable value is already at or below comparable homes&apos; implied value. Protesting can still
            lower your market value — which reduces future years&apos; ceiling — but will not cut this year&apos;s bill.
          </p>
        </div>
      )}
    </div>
  );
}

function ValueBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
      <p className="font-semibold mt-0.5">{value}</p>
    </div>
  );
}


function truncateAddress(addr: string): string {
  const parts = addr.split(" ");
  if (parts.length <= 3) return addr;
  return `${parts[0]} ${parts[1]} ${parts[2]}…`;
}
