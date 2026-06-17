import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getCounty } from "@/lib/db/queries";
import { usd, num } from "@/lib/format";
import AddressSearch from "@/components/AddressSearch";

export const revalidate = 86400;

interface Props {
  params: Promise<{ state: string; county: string }>;
}

export async function generateMetadata({ params }: Props) {
  try {
    const { county } = await params;
    const data = await getCounty(county);
    if (!data) return { title: "County not found" };
    return {
      title: `Protest your ${data.name} property tax — HouseData`,
      description: `See if your home is over-assessed in ${data.name}. Free instant check backed by public appraisal data.`,
    };
  } catch {
    return { title: "HouseData" };
  }
}

export default async function CountyPage({ params }: Props) {
  const { state, county } = await params;

  let data: Awaited<ReturnType<typeof getCounty>>;
  try {
    data = await getCounty(county);
  } catch {
    data = null;
  }
  if (!data) notFound();

  const sql = getDb();
  type StatsRow = { total_analyzed: string; pct_clear: string; avg_savings: string | null };
  let stats: StatsRow | null = null;
  try {
    const statsRows = (await sql`
      SELECT
        COUNT(*) AS total_analyzed,
        ROUND(100.0 * COUNT(*) FILTER (WHERE a.savings_case = 'clear') / NULLIF(COUNT(*), 0), 1) AS pct_clear,
        ROUND(AVG(a.annual_savings) FILTER (WHERE a.annual_savings > 0), 0) AS avg_savings
      FROM analysis a
      JOIN parcels p ON p.id = a.parcel_id
      JOIN counties c ON c.id = p.county_id
      WHERE c.slug = ${county}
    `) as unknown as StatsRow[];
    stats = statsRows[0] ?? null;
  } catch {
    // Stats unavailable — render page without the stats block
  }

  return (
    <main className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-10">
        <div>
          <Link href={`/${state}`} className="text-sm text-blue-600 hover:underline">← Back</Link>
          <h1 className="text-4xl font-bold mt-3">
            Protest your {data.name} property tax
          </h1>
          <p className="text-gray-600 mt-3 text-lg">
            Texas homeowners have the right to protest over-assessments every year.
            We analyze every residential parcel against comparable homes so you know
            whether you have a case — before you spend a dollar.
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-4">
            <StatBox label="Homes analyzed" value={num(Number(stats.total_analyzed))} />
            <StatBox label="With clear savings" value={`${stats.pct_clear}%`} />
            <StatBox label="Avg savings (where applicable)" value={stats.avg_savings ? usd(Number(stats.avg_savings)) : "—"} />
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-1">Filing deadline</h2>
          <p className="text-gray-700">{data.protest_deadline_rule}</p>
          {data.arb_filing_url && (
            <a href={data.arb_filing_url} target="_blank" rel="noopener noreferrer"
              className="inline-block mt-3 text-blue-600 hover:underline text-sm">
              File online at the {data.name} e-file portal →
            </a>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4">Check your address</h2>
          <AddressSearch state={state} countySlug={county} />
        </div>

        <div className="text-xs text-gray-400">
          Data source: {data.name} appraisal roll (public record). Not legal, tax, or financial advice.
          Not affiliated with any appraisal district.
        </div>
      </div>
    </main>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-5">
      <p className="text-3xl font-bold text-blue-700">{value}</p>
      <p className="text-gray-500 text-sm mt-1">{label}</p>
    </div>
  );
}
