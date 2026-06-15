# housedata.us — Property Tax Appeal Tool: Build Specification

This document is a complete handoff spec for building the product. Read it fully before writing code. Items marked **[VERIFY]** must be confirmed against live sources before implementation — do not guess or hallucinate these values.

---

## 1. Product summary

A web app at **housedata.us** that helps US homeowners protest over-assessed property taxes. Launch market: **one Texas county** (default: Travis County / Travis CAD — configurable, see §4). Texas is chosen deliberately: it is a non-disclosure state (sale prices are not public), so protests run heavily on **equity comps** — comparable *assessed* values — which ARE public via appraisal district data. Texas Tax Code §41.43(b)(3) entitles owners to relief if their appraised value exceeds the median appraised value of a reasonable number of comparable properties, appropriately adjusted.

**Two tiers:**

1. **Free checker (growth loop):** user enters their address → instant result: "Your assessment looks ~X% above comparable homes. Estimated overpayment: $Y/yr." Shareable via Open Graph image.
2. **Paid evidence packet ($49–79 one-time, annual by nature):** PDF containing an equity comps table, sales/AVM comps where available, the pre-filled Texas protest form (Form 50-132), filing deadline, and step-by-step filing instructions.

**Business context (do not re-litigate, but understand the positioning):**
- Main competitor: Ownwell (full-service, no upfront fee, takes ~25–35% of tax savings). We are the cheap DIY alternative: flat fee, user files themselves.
- Counties also offer free protest filing; our value is the *evidence*, not the filing.
- This must work better than what a homeowner can assemble in an afternoon, and the comps methodology must be defensible at an Appraisal Review Board (ARB) hearing.

---

## 2. Architecture overview

Two halves, deliberately decoupled:

```
ANNUAL BATCH PIPELINE (scripts, run ~once/year per county)
  County appraisal roll (bulk download)
    → parser/loader → Postgres
    → comps engine (precompute analysis for EVERY parcel)
    → results cached in DB

WEB APP (reads precomputed data, near-zero compute per request)
  Free checker: address typeahead → result card → shareable OG image
  Paid flow: Stripe Checkout → PDF packet generator → email + download
```

Key principle: **the appraisal roll changes once a year**, so all analysis is precomputed in batch. The web app does indexed reads only. This is what makes the product solo-operable and cheap to host.

---

## 3. Tech stack

- **Next.js** (App Router) + TypeScript
- **Postgres** . Use `pg_trgm` extension for address typeahead.
- **Stripe Checkout** for payments (single product per county; do NOT build custom billing UI)
- **PDF generation:** server-side. Use `pdf-lib` to fill the official Form 50-132 (fillable PDF), and Puppeteer (HTML template → PDF) or `react-pdf` for the evidence packet body. Pick one and stay consistent.
- **OG image generation:** `@vercel/og` (or `satori`) for shareable result cards.
- **Email:** Resend or Postmark for packet delivery.
- **Hosting:** cPanel.  optimize for simplicity.
- Batch pipeline: standalone TypeScript (or Python) scripts in a `/pipeline` directory, run manually/cron. NOT part of the web app runtime.

---

## 4. Data sources

### 4.1 County appraisal roll (primary, free)
- Texas appraisal districts publish full appraisal rolls as free bulk downloads (CSV or fixed-width exports). Travis CAD, HCAD (Harris), TAD (Tarrant), DCAD (Dallas), BCAD (Bexar) all do.
- **[VERIFY]** The current download URL, file format, layout/record spec, and field names for the chosen launch county. These change; fetch the district's data-export documentation before writing the parser.
- Fields needed per parcel (names vary by district — map them in a per-county config):
  - account / parcel ID
  - situs address (street, city, zip)
  - **neighborhood code** (the CAD's own comp grouping — critical, see §5)
  - state property class code (e.g. A1 = single-family residential)
  - market/appraised value (current year and prior year if present)
  - **assessed/taxable value** (differs from market value under homestead cap — see §6)
  - land value / improvement value split
  - living area sqft, year built, and if present: quality/condition class, beds/baths
  - exemption codes (homestead, over-65, disabled, etc.)
- Architect the loader as: per-county adapter (parsing + field mapping) → normalized common schema. Day one ships one adapter; the structure must make county #2 cheap.

### 4.2 Tax rates
- Combined property tax rate per jurisdiction (school district + county + city + special districts), needed to dollarize savings.
- **[VERIFY]** Current-year rates from the county tax assessor-collector and/or the Texas Comptroller's published rate tables. Store as `tax_rates` table keyed by jurisdiction + tax year. A parcel's total rate = sum of rates for its taxing jurisdictions; if jurisdiction mapping is unavailable in the roll, fall back to a city/ISD-level average and label the estimate accordingly.

### 4.3 RentCast API (supplemental, paid tier of the packet only)
- Used for sales comps / AVM / active listings to supplement equity comps (sale prices aren't public in TX).
- Has a free development tier; terms permit commercial use, storing data, and displaying it to end users. **[VERIFY]** current pricing tiers and rate limits at rentcast.io/api before integrating.
- Do NOT make the free checker depend on RentCast — the free tier must run entirely on locally stored roll data (zero marginal cost per lookup).
- Do NOT use ATTOM/Estated (Estated has been absorbed into ATTOM and deprecated; ATTOM is enterprise-priced) or BatchData (starts ~$1,000/mo). These are year-two options at most.

### 4.4 Form 50-132
- The official Texas "Notice of Protest" form, published by the Texas Comptroller as a fillable PDF.
- **[VERIFY]** Download the current-year version and inspect its actual form field names with `pdf-lib` before writing the fill code. Counties may also have their own variant or online-only filing — check the launch county's ARB instructions and note both paths in the packet.

---

## 5. The comps engine (core IP)

Runs in batch over every residential parcel in the county. For each subject parcel:

### 5.1 Comp selection
1. Same **neighborhood code** AND same state class code.
2. Living area within **±15%** of subject.
3. Year built within **±10 years** of subject.
4. Same quality/condition class if the field exists.
5. Exclude the subject itself; exclude parcels with zero/absent improvement value or missing sqft.
6. **Fallback:** if fewer than 5 comps survive, relax in order: widen sqft to ±20% → widen year built to ±15 → drop neighborhood code and use geographic radius (requires geocoding or CAD-provided coordinates; if coordinates are unavailable, fall back to same-zip + same class). Record which fallback level was used (`comp_quality` field) — surface low-confidence results honestly in the UI.

### 5.2 Analysis
- Compute appraised value per sqft for each comp.
- `median_comp_psf` = median of comp $/sqft.
- `subject_psf` = subject appraised value / subject sqft.
- `pct_above` = (subject_psf − median_comp_psf) / median_comp_psf.
- `implied_value` = median_comp_psf × subject sqft.
- `gross_overassessment` = max(0, subject appraised value − implied_value).

### 5.3 The homestead cap — DO NOT SKIP (most important correctness rule)
Texas caps the annual increase of a homestead's **assessed (taxable) value** at 10%, so assessed value is often far below market/appraised value. A protest reduces the **market value**; the owner only saves money this year if the reduced market value drops below their current assessed value.

For every parcel compute:
- `effective_new_taxable` = min(current assessed value, implied_value)
- `annual_savings` = max(0, current assessed value − effective_new_taxable) × combined tax rate

Then classify into exactly three cases, and the UI/packet must state the case plainly:
1. **Clear savings:** implied value < assessed value → show $Y/yr.
2. **Partial savings:** implied value between assessed and market value → show reduced $Y/yr.
3. **Capped — no current-year savings:** assessed value already at or below implied value → message: "Your taxable value is protected by the homestead cap. Protesting can still lower your market value, which reduces future years' ceiling, but it will not cut this year's bill." **Do not sell urgency to these users; do show the long-term rationale.** Never display a savings number > $0 for this case.

Selling a $49 packet to a capped homeowner who then saves $0 destroys the product via refunds and reviews. This logic must have unit tests covering all three cases.

### 5.4 Precompute and store
- Run for all parcels; write results to an `analysis` table keyed by (parcel_id, tax_year).
- Also compute aggregates per zip/neighborhood (share of homes assessed above comps median, average overassessment) — used for marketing pages and the result card ("31% of homes in 78745 are assessed above their neighbors").

---

## 6. Database schema (starting point — adjust as needed)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE counties (
  id serial PRIMARY KEY,
  slug text UNIQUE NOT NULL,          -- 'travis-tx'
  name text NOT NULL,
  state char(2) NOT NULL,
  protest_deadline_rule text,          -- human-readable, e.g. 'May 15 or 30 days after notice'
  arb_filing_url text
);

CREATE TABLE parcels (
  id bigserial PRIMARY KEY,
  county_id int REFERENCES counties(id),
  tax_year int NOT NULL,
  account_id text NOT NULL,            -- CAD account number
  situs_address text NOT NULL,
  situs_city text, situs_zip text,
  neighborhood_code text,
  state_class text,
  market_value numeric,
  assessed_value numeric,              -- taxable value (homestead cap applies here)
  land_value numeric, improvement_value numeric,
  living_sqft numeric, year_built int,
  quality_class text,
  exemptions text[],                   -- e.g. {'HS','OV65'}
  lat numeric, lng numeric,            -- nullable; only if CAD provides
  UNIQUE (county_id, tax_year, account_id)
);
CREATE INDEX ON parcels USING gin (situs_address gin_trgm_ops);
CREATE INDEX ON parcels (county_id, tax_year, neighborhood_code, state_class);

CREATE TABLE tax_rates (
  county_id int REFERENCES counties(id),
  tax_year int NOT NULL,
  jurisdiction text NOT NULL,
  rate numeric NOT NULL,               -- per $100 of value, as published; normalize on read
  PRIMARY KEY (county_id, tax_year, jurisdiction)
);

CREATE TABLE analysis (
  parcel_id bigint REFERENCES parcels(id) PRIMARY KEY,
  tax_year int NOT NULL,
  comp_count int,
  comp_quality text,                   -- 'strict' | 'relaxed_sqft' | 'relaxed_year' | 'radius' | 'zip'
  median_comp_psf numeric,
  subject_psf numeric,
  pct_above numeric,
  implied_value numeric,
  gross_overassessment numeric,
  savings_case text,                   -- 'clear' | 'partial' | 'capped'
  annual_savings numeric,              -- post-homestead-cap, the only number shown to users
  comp_ids bigint[]                    -- the comps used, for packet generation
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id bigint REFERENCES parcels(id),
  email text NOT NULL,
  stripe_session_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending',  -- pending | paid | delivered | refunded
  packet_url text,
  created_at timestamptz DEFAULT now()
);
```

**Data versioning rule:** everything is keyed by `tax_year`. Notices land ~April; the new roll must load as a new tax_year without breaking links to the old one. The UI always shows which tax year the analysis reflects. Traffic peaks exactly when the data rolls over — this must not look broken in April.

---

## 7. Free checker (web app)

**Pages/flows:**
- `/` — landing: one search box ("Enter your address"), one-line value prop, county coverage note.
- Address typeahead: trigram search against `parcels.situs_address` scoped to loaded counties. No external geocoding API — every valid address is already in the roll.
- `/p/[county]/[account_id]` — result page (server-rendered, public, indexable):
  - The headline number: "Assessed ~X% above comparable homes" with the comp count.
  - The savings line, governed strictly by `savings_case` (§5.3) — including the honest "capped" message.
  - A teaser of 2–3 comps (address truncated, $/sqft) with the rest blurred → CTA to the paid packet.
  - Estimated values labeled as estimates; methodology link; disclaimer (§10).
- OG image per result page (generated via @vercel/og): address area + "Assessed X% above comparable homes" — this is the unit of social sharing into Nextdoor/Facebook groups.
- `/[county]` — county landing page with aggregate stats (from §5.4) and deadline info, for local SEO ("Protest your Travis County appraisal").

**Performance target:** result page is a single indexed lookup of precomputed data — should render in <300ms. No per-request computation.

---

## 8. Paid packet ($49 launch price; make price a config value)

**Flow:** result page → Stripe Checkout (collect email) → webhook marks order paid → packet generated server-side → emailed + download link on a success page. Idempotent webhook handling; orders table tracks state.

**Packet contents (PDF):**
1. **Cover summary:** property, current market & assessed values, implied value, the savings math shown transparently including homestead-cap treatment, proposed opinion of value.
2. **Equity comps table:** the 5–10 comps from `analysis.comp_ids` — account #, address, sqft, year built, class, appraised value, $/sqft — with the median highlighted and a short plain-English explanation of the §41.43(b)(3) equity argument. This is the document the owner hands the ARB.
3. **Sales/AVM comps section (best-effort):** pulled from RentCast at generation time; if unavailable, omit the section gracefully rather than padding with weak data.
4. **Pre-filled Form 50-132** via pdf-lib: owner name (collected at checkout), property account, address, protest reasons checked ("incorrect appraised value" and "unequal appraisal"), opinion of value = implied value. Leave signature blank.
5. **Filing instructions:** county-specific — deadline (**[VERIFY]** per county; Texas default is May 15 or 30 days after the notice, whichever is later), where/how to file (online portal if the county has one), what an informal hearing is like, and a one-page "what to say" script grounded in the comps table.

Generation must be reproducible: store the packet (S3/Supabase storage) and link it on the order, so re-downloads don't regenerate against changed data.

---

## 9. Build milestones (in order; do not reorder)

1. **Pipeline first.** County adapter for the launch county: download → parse → load `parcels` + `tax_rates`. Acceptance: row counts match the district's published parcel counts within ~1%; spot-check 10 known addresses against the CAD's own public property search.
2. **Comps engine + tests.** Acceptance: unit tests for all three `savings_case` branches; manual review of 20 sample parcels — comps must look like genuinely similar homes (this is a human-judgment gate; print them and eyeball).
3. **Free checker.** Typeahead, result page, OG image, county landing page.
4. **Payments + packet.** Stripe Checkout, webhook, PDF generation, 50-132 fill, email delivery.
5. **Hardening for season:** rate limiting on search, basic analytics (which zips search, free→paid conversion), refund path, tax-year rollover dry run.

Do NOT build in v1: user accounts, multi-county UI complexity beyond the adapter pattern, monitoring/alerts, subscriptions, admin dashboards beyond a simple orders view, any nationwide ambitions.

---

## 10. Edge cases, gotchas, compliance

- **Homestead cap (§5.3)** — the #1 correctness risk. Test it.
- **New construction / recent remodels:** prior-year comparisons and equity comps both behave oddly; if year_built == tax_year or improvement value jumped >50% YoY, flag the result as low-confidence rather than showing a confident number.
- **Multi-improvement parcels, partial exemptions, ag-use valuations:** exclude non-standard parcels (state class outside single-family residential) from both subject eligibility and comp pools in v1.
- **Missing sqft or values:** exclude from comp pools; if the *subject* is missing data, show "we can't analyze this property automatically" rather than a wrong number.
- **Address messiness:** normalize on load (uppercase, standard suffixes); typeahead must tolerate "St/Street", missing unit numbers.
- **Disclaimers everywhere:** "Estimates based on public appraisal district data. Not legal, tax, or financial advice. No outcome is guaranteed." Also: "Not affiliated with any appraisal district." Include a visible data source + tax year on every result.
- **Refund policy:** plain, generous (e.g., full refund if the packet contains a material data error). State it pre-purchase.
- **Privacy posture:** all displayed data is public record, but do not display owner names on free pages; the user supplies their own name at checkout for the form.
- **Seasonality:** notices land ~April, deadline ~May 15. The tax-year rollover (§6) and a "deadline passed — get ready for next year" mode for the off-season both need to exist.

---

## 11. Configuration & environment

```
DATABASE_URL=
STRIPE_SECRET_KEY= / STRIPE_WEBHOOK_SECRET= / STRIPE_PRICE_ID=
RENTCAST_API_KEY=            # optional; packet degrades gracefully without it
RESEND_API_KEY=              # or Postmark
NEXT_PUBLIC_BASE_URL=https://housedata.us
PACKET_PRICE_USD=49
LAUNCH_COUNTY=travis-tx
```

Per-county config lives in code (`/pipeline/counties/travis-tx.ts`): download URLs **[VERIFY]**, field mappings, deadline rule, ARB filing URL, jurisdiction→rate mapping.

---

## 12. Definition of done (v1)

- A Travis County homeowner can: search their address → see an honest, comp-backed assessment gap and savings estimate (correct across all three homestead-cap cases) → pay $49 → receive within minutes a PDF with a defensible equity comps table and a pre-filled 50-132 → file their own protest before the deadline.
- The operator (solo founder) can: load next year's roll with one command, see orders and conversion in a simple view, and add county #2 by writing one adapter file.