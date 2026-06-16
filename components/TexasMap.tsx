"use client";

import { useEffect, useRef, useState } from "react";

interface CountyPath {
  id: string;
  name: string;
  d: string;
}

interface MapData {
  viewBox: string;
  paths: CountyPath[];
}

interface Props {
  onTravisClick: () => void;
  onCollinClick: () => void;
}

const TRAVIS_FIPS = "48453";
const COLLIN_FIPS  = "48085";

const ONBOARDED: Record<string, true> = {
  "48453": true, // Travis County
  "48085": true, // Collin County
};

// Counties highlighted as "coming soon" in red
const COMING_SOON: Record<string, true> = {
  "48201": true, // Harris County (Houston)
  "48113": true, // Dallas County
  "48439": true, // Tarrant County (Fort Worth)
  "48029": true, // Bexar County (San Antonio)
  "48121": true, // Denton County
  "48157": true, // Fort Bend County (Sugar Land)
  "48339": true, // Montgomery County (The Woodlands)
  "48491": true, // Williamson County (Round Rock)
  "48141": true, // El Paso County
};

export default function TexasMap({ onTravisClick, onCollinClick }: Props) {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetch("/texas-county-paths.json")
      .then((r) => r.json())
      .then(setMapData)
      .catch(console.error);
  }, []);

  if (!mapData) {
    return (
      <div className="w-full aspect-[960/680] flex items-center justify-center text-gray-400">
        Loading map…
      </div>
    );
  }

  function handleMouseEnter(e: React.MouseEvent<SVGPathElement>, id: string, name: string) {
    setHovered(id);
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      let label: string;
      if (ONBOARDED[id]) label = `${name} County — Click to search`;
      else if (COMING_SOON[id]) label = `${name} County — Coming soon`;
      else label = `${name} County — Not yet available`;
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 12, label });
    }
  }

  function handleMouseMove(e: React.MouseEvent<SVGPathElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect && tooltip) {
      setTooltip((t) => t ? { ...t, x: e.clientX - rect.left, y: e.clientY - rect.top - 12 } : null);
    }
  }

  function handleMouseLeave() {
    setHovered(null);
    setTooltip(null);
  }

  function handleClick(id: string) {
    if (id === TRAVIS_FIPS) onTravisClick();
    if (id === COLLIN_FIPS) onCollinClick();
  }

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={mapData.viewBox}
        className="w-full h-auto"
        style={{ maxHeight: 420 }}
      >
        {mapData.paths.map(({ id, name, d }) => {
          const isOnboarded = !!ONBOARDED[id];
          const isHovered = hovered === id;

          const isComingSoon = !!COMING_SOON[id];

          let fill: string;
          if (isOnboarded) {
            fill = isHovered ? "#1d4ed8" : "#2563eb";
          } else if (isComingSoon) {
            fill = isHovered ? "#b91c1c" : "#dc2626";
          } else {
            fill = isHovered ? "#d1d5db" : "#e5e7eb";
          }

          return (
            <path
              key={id}
              d={d}
              fill={fill}
              stroke="#fff"
              strokeWidth={0.5}
              style={{ cursor: isOnboarded || isComingSoon ? "pointer" : "default", transition: "fill 0.1s" }}
              onMouseEnter={(e) => handleMouseEnter(e, id, name)}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleClick(id)}
            />
          );
        })}

        {/* County labels for onboarded counties */}
        {[
          { fips: TRAVIS_FIPS, label: "Travis", x: 522, y: 375 },
          { fips: COLLIN_FIPS,  label: "Collin",  x: 583, y: 238 },
        ].map(({ fips, label, x, y }) =>
          mapData.paths.find((p) => p.id === fips) ? (
            <text
              key={fips}
              x={x}
              y={y}
              textAnchor="middle"
              fontSize={11}
              fontWeight="bold"
              fill="white"
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {label}
            </text>
          ) : null
        )}
      </svg>

      {/* Tooltip for coming-soon counties */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
        >
          {tooltip.label}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-600" /> Available now
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-600" /> Coming soon
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-gray-200 border border-gray-300" /> Not yet available
        </span>
      </div>
    </div>
  );
}
