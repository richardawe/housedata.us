"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  getProtestEvents,
  getEventsForDay,
  getPrimaryEventType,
  todayISO,
  EVENT_META,
  EVENT_PRIORITY,
  STATE_FILTERS,
  MONTH_NAMES,
  type ProtestEvent,
  type EventType,
} from "@/lib/protest-calendar";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateRange(start: string, end: string): string {
  const parts = (d: string) => d.split("-").map(Number);
  const [sy, sm, sd] = parts(start);
  const [ey, em, ed] = parts(end);
  if (start === end) return `${MONTH_NAMES[sm - 1]} ${sd}, ${sy}`;
  if (sy === ey && sm === em) return `${MONTH_NAMES[sm - 1]} ${sd}–${ed}, ${sy}`;
  if (sy === ey)
    return `${MONTH_NAMES[sm - 1]} ${sd} – ${MONTH_NAMES[em - 1]} ${ed}, ${sy}`;
  return `${MONTH_NAMES[sm - 1]} ${sd}, ${sy} – ${MONTH_NAMES[em - 1]} ${ed}, ${ey}`;
}

function getStatus(event: ProtestEvent, today: string): "past" | "active" | "upcoming" {
  if (event.endDate < today) return "past";
  if (event.startDate <= today) return "active";
  return "upcoming";
}

// Tailwind class helpers — explicit strings so Tailwind scanner picks them up
function badgeClass(type: EventType): string {
  switch (type) {
    case "filing-window":  return "bg-blue-100 text-blue-800";
    case "deadline":       return "bg-red-100 text-red-800";
    case "hearing-period": return "bg-orange-100 text-orange-800";
    case "notice-period":  return "bg-emerald-100 text-emerald-800";
  }
}

function dotClass(type: EventType): string {
  switch (type) {
    case "filing-window":  return "bg-blue-500";
    case "deadline":       return "bg-red-500";
    case "hearing-period": return "bg-orange-500";
    case "notice-period":  return "bg-emerald-500";
  }
}

function cellBgClass(type: EventType | null): string {
  if (!type) return "bg-white";
  switch (type) {
    case "filing-window":  return "bg-blue-50";
    case "deadline":       return "bg-red-50";
    case "hearing-period": return "bg-orange-50";
    case "notice-period":  return "bg-emerald-50";
  }
}

// ─── EventCard ────────────────────────────────────────────────────────────────

function EventCard({ event, today }: { event: ProtestEvent; today: string }) {
  const status = getStatus(event, today);
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass(event.type)}`}>
              {EVENT_META[event.type].label}
            </span>
            <span className="text-xs text-gray-500">{event.stateName}</span>
            {event.county && (
              <span className="text-xs text-gray-400">· {event.county}</span>
            )}
            {event.isLive && (
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                Live
              </span>
            )}
            {status === "active" && (
              <span className="text-xs font-medium text-emerald-600">· Active now</span>
            )}
            {status === "past" && (
              <span className="text-xs text-gray-400">· Past</span>
            )}
          </div>
          <p className="font-semibold text-gray-900 text-sm">{event.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDateRange(event.startDate, event.endDate)}
          </p>
          {event.notes && (
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{event.notes}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {event.countySlug && event.isLive && (
            <Link
              href={`/${event.stateSlug}/${event.countySlug}`}
              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
            >
              Check your home →
            </Link>
          )}
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:underline whitespace-nowrap"
            >
              Official link →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ListEvent ────────────────────────────────────────────────────────────────

function ListEvent({ event, today }: { event: ProtestEvent; today: string }) {
  const status = getStatus(event, today);
  return (
    <div
      className={`border rounded-xl p-4 transition ${
        status === "past"
          ? "border-gray-100 bg-gray-50 opacity-60"
          : status === "active"
          ? "border-blue-200 bg-blue-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass(event.type)}`}>
              {EVENT_META[event.type].label}
            </span>
            <span className="text-xs text-gray-500 font-medium">{event.stateName}</span>
            {event.county && (
              <span className="text-xs text-gray-400">· {event.county}</span>
            )}
            {event.isLive && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                Live
              </span>
            )}
            {status === "active" && (
              <span className="text-xs font-medium text-emerald-600">· Active now</span>
            )}
            {status === "past" && (
              <span className="text-xs text-gray-400">· Past</span>
            )}
          </div>
          <p className={`font-semibold ${status === "past" ? "text-gray-400" : "text-gray-900"}`}>
            {event.title}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            {formatDateRange(event.startDate, event.endDate)}
          </p>
          {event.notes && (
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{event.notes}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {event.countySlug && event.isLive && (
            <Link
              href={`/${event.stateSlug}/${event.countySlug}`}
              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
            >
              Check your home →
            </Link>
          )}
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:underline whitespace-nowrap"
            >
              Official link →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProtestCalendar() {
  const today = todayISO();
  const nowYear  = parseInt(today.slice(0, 4), 10);
  const nowMonth = parseInt(today.slice(5, 7), 10) - 1; // 0-indexed

  const [year, setYear]             = useState(nowYear);
  const [month, setMonth]           = useState(nowMonth);
  const [stateFilter, setStateFilter] = useState("ALL");
  const [viewMode, setViewMode]     = useState<"calendar" | "list">("calendar");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const allEvents = useMemo(() => getProtestEvents([2025, 2026, 2027]), []);

  const filteredEvents = useMemo(
    () =>
      stateFilter === "ALL"
        ? allEvents
        : allEvents.filter((e) => e.state === stateFilter),
    [allEvents, stateFilter]
  );

  // Build calendar grid cells for the current month
  const calendarCells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; dateStr: string | null }> = [];

    for (let i = 0; i < firstDow; i++) cells.push({ day: null, dateStr: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, dateStr: `${year}-${pad(month + 1)}-${pad(d)}` });
    }
    const tail = (7 - (cells.length % 7)) % 7;
    for (let i = 0; i < tail; i++) cells.push({ day: null, dateStr: null });

    return cells;
  }, [year, month]);

  const selectedDayEvents = useMemo(
    () => (selectedDay ? getEventsForDay(selectedDay, filteredEvents) : []),
    [selectedDay, filteredEvents]
  );

  // List view: all events for the selected year, sorted
  const listEvents = useMemo(
    () =>
      filteredEvents
        .filter(
          (e) =>
            e.startDate.slice(0, 4) === String(year) ||
            e.endDate.slice(0, 4) === String(year)
        )
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [filteredEvents, year]
  );

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((prev) => prev - 1);
    } else {
      setMonth((prev) => prev - 1);
    }
    setSelectedDay(null);
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((prev) => prev + 1);
    } else {
      setMonth((prev) => prev + 1);
    }
    setSelectedDay(null);
  }

  return (
    <div className="space-y-6">
      {/* Top bar: year nav + view toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setYear((prev) => prev - 1); setSelectedDay(null); }}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition"
            aria-label="Previous year"
          >
            ← {year - 1}
          </button>
          <span className="font-bold text-xl text-gray-900 w-14 text-center">{year}</span>
          <button
            onClick={() => { setYear((prev) => prev + 1); setSelectedDay(null); }}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition"
            aria-label="Next year"
          >
            {year + 1} →
          </button>
        </div>

        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          <button
            onClick={() => setViewMode("calendar")}
            className={`px-4 py-1.5 font-medium transition ${
              viewMode === "calendar"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-4 py-1.5 font-medium transition ${
              viewMode === "list"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* State filter */}
      <div className="flex flex-wrap gap-2">
        {STATE_FILTERS.map((f) => (
          <button
            key={f.code}
            onClick={() => { setStateFilter(f.code); setSelectedDay(null); }}
            className={`px-3 py-1 text-sm rounded-full border font-medium transition ${
              stateFilter === f.code
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Calendar view ── */}
      {viewMode === "calendar" && (
        <div className="space-y-3">
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={prevMonth}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition"
            >
              ‹ {MONTH_NAMES[(month + 11) % 12].slice(0, 3)}
            </button>
            <h2 className="font-semibold text-lg">
              {MONTH_NAMES[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition"
            >
              {MONTH_NAMES[(month + 1) % 12].slice(0, 3)} ›
            </button>
          </div>

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border border-gray-100 rounded-t-xl overflow-hidden">
            {DAYS_OF_WEEK.map((d) => (
              <div
                key={d}
                className="bg-gray-50 py-2 text-center text-xs font-medium text-gray-500"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 border border-gray-100 rounded-b-xl overflow-hidden border-t-0 -mt-px">
            {calendarCells.map((cell, i) => {
              if (!cell.day || !cell.dateStr) {
                return (
                  <div
                    key={i}
                    className="bg-white min-h-[60px] border-t border-r border-gray-100 last:border-r-0"
                  />
                );
              }

              const dayEvents = getEventsForDay(cell.dateStr, filteredEvents);
              const primaryType = getPrimaryEventType(dayEvents);
              const isToday = cell.dateStr === today;
              const isSelected = cell.dateStr === selectedDay;
              const uniqueTypes = Array.from(new Set(dayEvents.map((e) => e.type))).sort(
                (a, b) => EVENT_PRIORITY[b as EventType] - EVENT_PRIORITY[a as EventType]
              ) as EventType[];

              return (
                <div
                  key={i}
                  onClick={() =>
                    setSelectedDay(isSelected ? null : cell.dateStr)
                  }
                  className={`min-h-[60px] p-1.5 cursor-pointer border-t border-r border-gray-100 last:border-r-0 transition
                    ${cellBgClass(primaryType)}
                    ${isSelected ? "ring-2 ring-inset ring-blue-500" : ""}
                    ${!primaryType ? "hover:bg-gray-50" : ""}
                  `}
                >
                  <span
                    className={`text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full
                      ${isToday ? "bg-blue-600 text-white" : "text-gray-800"}
                    `}
                  >
                    {cell.day}
                  </span>
                  {uniqueTypes.length > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-wrap">
                      {uniqueTypes.slice(0, 4).map((type) => (
                        <span
                          key={type}
                          className={`w-1.5 h-1.5 rounded-full ${dotClass(type)}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected day panel */}
          {selectedDay && (
            <div className="border border-blue-100 rounded-xl p-4 bg-blue-50 space-y-3">
              <h3 className="font-semibold text-blue-900 text-sm">
                {(() => {
                  const [sy, sm, sd] = selectedDay.split("-").map(Number);
                  return `${MONTH_NAMES[sm - 1]} ${sd}, ${sy}`;
                })()}
              </h3>
              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No events on this date
                  {stateFilter !== "ALL" ? " for this state" : ""}.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map((event) => (
                    <EventCard key={event.id} event={event} today={today} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 pt-1">
            {(Object.keys(EVENT_META) as EventType[]).map((type) => (
              <div key={type} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`w-2.5 h-2.5 rounded-full ${dotClass(type)}`} />
                {EVENT_META[type].label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── List view ── */}
      {viewMode === "list" && (
        <div className="space-y-2">
          {listEvents.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">
              No events for {year}
              {stateFilter !== "ALL" ? ` in ${STATE_FILTERS.find((f) => f.code === stateFilter)?.label}` : ""}.
            </p>
          ) : (
            listEvents.map((event) => (
              <ListEvent key={event.id} event={event} today={today} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
