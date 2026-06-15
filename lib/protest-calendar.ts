export type EventType =
  | 'filing-window'
  | 'deadline'
  | 'hearing-period'
  | 'notice-period';

export interface ProtestEvent {
  id: string;
  state: string;        // "TX"
  stateSlug: string;    // "texas"
  stateName: string;    // "Texas"
  county?: string;      // "Travis County" (undefined = statewide)
  countySlug?: string;  // "travis-tx"
  title: string;
  type: EventType;
  startDate: string;    // "YYYY-MM-DD"
  endDate: string;      // "YYYY-MM-DD"
  notes?: string;
  url?: string;
  isLive: boolean;
}

export const EVENT_META: Record<EventType, {
  label: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
  borderClass: string;
}> = {
  'filing-window': {
    label: 'Filing Window',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    dotClass: 'bg-blue-500',
    borderClass: 'border-blue-200',
  },
  'deadline': {
    label: 'Deadline',
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
    dotClass: 'bg-red-500',
    borderClass: 'border-red-200',
  },
  'hearing-period': {
    label: 'Hearing Period',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700',
    dotClass: 'bg-orange-500',
    borderClass: 'border-orange-200',
  },
  'notice-period': {
    label: 'Notice Period',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    dotClass: 'bg-emerald-500',
    borderClass: 'border-emerald-200',
  },
};

export const EVENT_PRIORITY: Record<EventType, number> = {
  deadline: 4,
  'hearing-period': 3,
  'filing-window': 2,
  'notice-period': 1,
};

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const STATE_FILTERS = [
  { code: 'ALL', label: 'All States', slug: '' },
  { code: 'TX',  label: 'Texas',          slug: 'texas' },
  { code: 'CA',  label: 'California',     slug: 'california' },
  { code: 'FL',  label: 'Florida',        slug: 'florida' },
  { code: 'NY',  label: 'New York',       slug: 'new-york' },
  { code: 'IL',  label: 'Illinois',       slug: 'illinois' },
  { code: 'OH',  label: 'Ohio',           slug: 'ohio' },
  { code: 'GA',  label: 'Georgia',        slug: 'georgia' },
  { code: 'NC',  label: 'North Carolina', slug: 'north-carolina' },
  { code: 'AZ',  label: 'Arizona',        slug: 'arizona' },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

export function todayISO(): string {
  const t = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

function p(n: number): string {
  return String(n).padStart(2, '0');
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${p(month)}-${p(day)}`;
}

/** Return the date string for the Nth Tuesday of May in `year`. */
function nthTuesdayOfMay(year: number, n: number): string {
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const date = new Date(year, 4, d);
    if (date.getMonth() !== 4) break;
    if (date.getDay() === 2) {
      count++;
      if (count === n) return iso(year, 5, d);
    }
  }
  return iso(year, 5, 28); // fallback
}

// ─── per-state event generators ───────────────────────────────────────────────

function txEvents(year: number): ProtestEvent[] {
  return [
    {
      id: `tx-filing-window-${year}`,
      state: 'TX', stateSlug: 'texas', stateName: 'Texas',
      title: 'Texas Property Tax Protest Window',
      type: 'filing-window',
      startDate: iso(year, 1, 1),
      endDate:   iso(year, 5, 15),
      notes: 'January 1 through May 15. If your Notice of Appraised Value is mailed after April 15 you have 30 days from that date instead.',
      url: 'https://comptroller.texas.gov/taxes/property-tax/taxpayer-rights/',
      isLive: true,
    },
    {
      id: `tx-travis-deadline-${year}`,
      state: 'TX', stateSlug: 'texas', stateName: 'Texas',
      county: 'Travis County', countySlug: 'travis-tx',
      title: 'Travis County Protest Deadline',
      type: 'deadline',
      startDate: iso(year, 5, 15),
      endDate:   iso(year, 5, 15),
      notes: 'May 15, or 30 days after your Notice of Appraised Value — whichever is later.',
      url: 'https://traviscad.org/efile/',
      isLive: true,
    },
    {
      id: `tx-arb-hearings-${year}`,
      state: 'TX', stateSlug: 'texas', stateName: 'Texas',
      title: 'Texas ARB Hearing Period',
      type: 'hearing-period',
      startDate: iso(year, 5, 1),
      endDate:   iso(year, 7, 31),
      notes: 'Appraisal Review Board hearings are typically scheduled May through July after protests are filed.',
      isLive: true,
    },
  ];
}

function caEvents(year: number): ProtestEvent[] {
  return [
    {
      id: `ca-appeal-window-${year}`,
      state: 'CA', stateSlug: 'california', stateName: 'California',
      title: 'California Assessment Appeal Window',
      type: 'filing-window',
      startDate: iso(year, 7, 2),
      endDate:   iso(year, 11, 30),
      notes: 'July 2 – November 30 for regular roll assessments. For supplemental assessments you have 60 days from the notice date.',
      url: 'https://www.boe.ca.gov/proptaxes/appeals.htm',
      isLive: false,
    },
  ];
}

function flEvents(year: number): ProtestEvent[] {
  return [
    {
      id: `fl-trim-notice-${year}`,
      state: 'FL', stateSlug: 'florida', stateName: 'Florida',
      title: 'Florida TRIM Notices Mailed',
      type: 'notice-period',
      startDate: iso(year, 8, 15),
      endDate:   iso(year, 8, 22),
      notes: 'County property appraisers mail Truth in Millage (TRIM) notices — typically August 15–22.',
      isLive: false,
    },
    {
      id: `fl-vab-deadline-${year}`,
      state: 'FL', stateSlug: 'florida', stateName: 'Florida',
      title: 'Florida VAB Petition Deadline',
      type: 'deadline',
      startDate: iso(year, 9, 16),
      endDate:   iso(year, 9, 16),
      notes: '25 days after the TRIM mailing date (approx. September 9–16). Exact date varies by county.',
      url: 'https://floridarevenue.com/property/Pages/taxpayers_vab.aspx',
      isLive: false,
    },
  ];
}

function nyEvents(year: number): ProtestEvent[] {
  const grievanceDay = nthTuesdayOfMay(year, 4);
  return [
    {
      id: `ny-nyc-deadline-${year}`,
      state: 'NY', stateSlug: 'new-york', stateName: 'New York',
      county: 'New York City',
      title: 'NYC Tax Commission Application Deadline',
      type: 'deadline',
      startDate: iso(year, 1, 15),
      endDate:   iso(year, 1, 15),
      notes: 'January 15 deadline to file with the NYC Tax Commission for a reduced assessment.',
      url: 'https://www.nyc.gov/site/taxcommission/filing/application.page',
      isLive: false,
    },
    {
      id: `ny-nassau-window-${year}`,
      state: 'NY', stateSlug: 'new-york', stateName: 'New York',
      county: 'Nassau County',
      title: 'Nassau County Assessment Challenge',
      type: 'filing-window',
      startDate: iso(year, 1, 2),
      endDate:   iso(year, 3, 1),
      notes: 'Nassau County: January 2 – March 1.',
      url: 'https://www.nassaucountyny.gov/2706/Assessment-Review-Commission',
      isLive: false,
    },
    {
      id: `ny-grievance-day-${year}`,
      state: 'NY', stateSlug: 'new-york', stateName: 'New York',
      title: 'New York Grievance Day (Most Counties)',
      type: 'deadline',
      startDate: grievanceDay,
      endDate:   grievanceDay,
      notes: 'Fourth Tuesday in May for most New York localities. File Form RP-524 with your local Board of Assessment Review.',
      url: 'https://www.tax.ny.gov/pit/property/appeal/',
      isLive: false,
    },
  ];
}

function ilEvents(year: number): ProtestEvent[] {
  return [
    {
      id: `il-ptab-window-${year}`,
      state: 'IL', stateSlug: 'illinois', stateName: 'Illinois',
      title: 'Illinois PTAB Appeal Window (Most Counties)',
      type: 'filing-window',
      startDate: iso(year, 1, 1),
      endDate:   iso(year, 3, 31),
      notes: 'Property Tax Appeal Board: January 1 – March 31 for most downstate Illinois counties.',
      url: 'https://www2.illinois.gov/rev/programs/PTAB/Pages/default.aspx',
      isLive: false,
    },
    {
      id: `il-cook-appeal-${year}`,
      state: 'IL', stateSlug: 'illinois', stateName: 'Illinois',
      county: 'Cook County',
      title: 'Cook County Assessment Appeals',
      type: 'filing-window',
      startDate: iso(year, 6, 1),
      endDate:   iso(year, 8, 10),
      notes: 'Cook County townships open on a rotating schedule June–August. Check the Cook County Assessor for your specific township dates.',
      url: 'https://www.cookcountyassessor.com/appeals',
      isLive: false,
    },
  ];
}

function ohEvents(year: number): ProtestEvent[] {
  return [
    {
      id: `oh-bor-window-${year}`,
      state: 'OH', stateSlug: 'ohio', stateName: 'Ohio',
      title: 'Ohio Board of Revision Filing Window',
      type: 'filing-window',
      startDate: iso(year, 1, 1),
      endDate:   iso(year, 3, 31),
      notes: 'File a complaint with your County Board of Revision between January 1 and March 31.',
      url: 'https://www.tax.ohio.gov/real-property',
      isLive: false,
    },
  ];
}

function gaEvents(year: number): ProtestEvent[] {
  return [
    {
      id: `ga-notice-period-${year}`,
      state: 'GA', stateSlug: 'georgia', stateName: 'Georgia',
      title: 'Georgia Assessment Notices Mailed',
      type: 'notice-period',
      startDate: iso(year, 4, 1),
      endDate:   iso(year, 5, 31),
      notes: 'County assessors typically mail annual assessment notices April–May.',
      isLive: false,
    },
    {
      id: `ga-appeal-window-${year}`,
      state: 'GA', stateSlug: 'georgia', stateName: 'Georgia',
      title: 'Georgia Assessment Appeal Window',
      type: 'filing-window',
      startDate: iso(year, 4, 1),
      endDate:   iso(year, 7, 15),
      notes: '45 days from your Notice of Assessment date. Typical window: April–July.',
      url: 'https://dor.georgia.gov/assessment-appeals',
      isLive: false,
    },
  ];
}

function ncEvents(year: number): ProtestEvent[] {
  return [
    {
      id: `nc-informal-appeal-${year}`,
      state: 'NC', stateSlug: 'north-carolina', stateName: 'North Carolina',
      title: 'North Carolina Informal Appeal Period',
      type: 'filing-window',
      startDate: iso(year, 1, 1),
      endDate:   iso(year, 4, 30),
      notes: 'Many counties hold informal review periods January–April during reappraisal years. Confirm with your county assessor.',
      url: 'https://www.ncdor.gov/taxes-forms/property-tax/property-taxpayer-rights-remedies',
      isLive: false,
    },
  ];
}

function azEvents(year: number): ProtestEvent[] {
  return [
    {
      id: `az-notice-${year}`,
      state: 'AZ', stateSlug: 'arizona', stateName: 'Arizona',
      title: 'Arizona Notices of Valuation Mailed',
      type: 'notice-period',
      startDate: iso(year, 2, 28),
      endDate:   iso(year, 2, 28),
      notes: 'County assessors mail Notices of Valuation by February 28.',
      isLive: false,
    },
    {
      id: `az-assessor-deadline-${year}`,
      state: 'AZ', stateSlug: 'arizona', stateName: 'Arizona',
      title: 'Arizona Assessor Appeal Deadline',
      type: 'deadline',
      startDate: iso(year, 4, 24),
      endDate:   iso(year, 4, 24),
      notes: 'File your appeal with the County Assessor by April 24.',
      url: 'https://azdor.gov/property-tax/assessment-appeals',
      isLive: false,
    },
    {
      id: `az-sboe-deadline-${year}`,
      state: 'AZ', stateSlug: 'arizona', stateName: 'Arizona',
      title: 'Arizona State Board of Equalization Deadline',
      type: 'deadline',
      startDate: iso(year, 9, 1),
      endDate:   iso(year, 9, 1),
      notes: 'File with the State Board of Equalization by September 1 for the current tax year.',
      isLive: false,
    },
  ];
}

// ─── public API ───────────────────────────────────────────────────────────────

export function getProtestEvents(years: number[] = [2025, 2026, 2027]): ProtestEvent[] {
  const events: ProtestEvent[] = [];
  for (const year of years) {
    events.push(
      ...txEvents(year),
      ...caEvents(year),
      ...flEvents(year),
      ...nyEvents(year),
      ...ilEvents(year),
      ...ohEvents(year),
      ...gaEvents(year),
      ...ncEvents(year),
      ...azEvents(year),
    );
  }
  return events.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function getEventsForDay(dateStr: string, events: ProtestEvent[]): ProtestEvent[] {
  return events.filter(e => dateStr >= e.startDate && dateStr <= e.endDate);
}

export function getPrimaryEventType(dayEvents: ProtestEvent[]): EventType | null {
  if (!dayEvents.length) return null;
  return dayEvents.reduce((best, e) =>
    EVENT_PRIORITY[e.type] >= EVENT_PRIORITY[best.type] ? e : best
  ).type;
}

/** Returns upcoming events for a specific state, sorted by startDate. */
export function getUpcomingForState(
  stateCode: string,
  limit = 3,
  types?: EventType[],
): ProtestEvent[] {
  const today = todayISO();
  const year = new Date().getFullYear();
  const all = getProtestEvents([year, year + 1]);
  return all
    .filter(e =>
      e.state === stateCode &&
      e.endDate >= today &&
      (!types || types.includes(e.type))
    )
    .slice(0, limit);
}
