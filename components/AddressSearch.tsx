"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Suggestion {
  account_id: string;
  situs_address: string;
  situs_city: string | null;
  situs_zip: string | null;
  county_slug: string;
}

interface Props {
  state: string;
  countySlug: string;
}

export default function AddressSearch({ state, countySlug }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (query.length < 3) { setSuggestions([]); setOpen(false); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&county=${encodeURIComponent(countySlug)}`);
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 200);
  }, [query, countySlug]);

  function select(s: Suggestion) {
    setOpen(false);
    router.push(`/${state}/${s.county_slug}/${s.account_id}`);
  }

  return (
    <div className="relative w-full text-left">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="123 Main St, Austin TX"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="off"
        />
        <button
          type="button"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-3 rounded-lg transition"
          onClick={() => suggestions[0] && select(suggestions[0])}
        >
          Check
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg divide-y divide-gray-100">
          {suggestions.map((s) => (
            <li
              key={s.account_id}
              className="px-4 py-3 cursor-pointer hover:bg-blue-50 text-sm"
              onMouseDown={() => select(s)}
            >
              <span className="font-medium">{s.situs_address}</span>
              {s.situs_city && (
                <span className="text-gray-500 ml-1">
                  {s.situs_city}{s.situs_zip ? `, ${s.situs_zip}` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {loading && (
        <p className="absolute right-4 top-3 text-gray-400 text-sm pointer-events-none">
          Searching…
        </p>
      )}
    </div>
  );
}
