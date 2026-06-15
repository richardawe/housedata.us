CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE counties (
  id serial PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  state char(2) NOT NULL,
  protest_deadline_rule text,
  arb_filing_url text
);

CREATE TABLE parcels (
  id bigserial PRIMARY KEY,
  county_id int REFERENCES counties(id),
  tax_year int NOT NULL,
  account_id text NOT NULL,
  situs_address text NOT NULL,
  situs_city text,
  situs_zip text,
  neighborhood_code text,
  state_class text,
  market_value numeric,
  assessed_value numeric,
  land_value numeric,
  improvement_value numeric,
  living_sqft numeric,
  year_built int,
  quality_class text,
  exemptions text[],
  lat numeric,
  lng numeric,
  UNIQUE (county_id, tax_year, account_id)
);

CREATE INDEX ON parcels USING gin (situs_address gin_trgm_ops);
CREATE INDEX ON parcels (county_id, tax_year, neighborhood_code, state_class);
CREATE INDEX ON parcels (county_id, tax_year, account_id);
CREATE INDEX ON parcels (situs_zip, state_class);

CREATE TABLE tax_rates (
  county_id int REFERENCES counties(id),
  tax_year int NOT NULL,
  jurisdiction text NOT NULL,
  rate numeric NOT NULL,
  PRIMARY KEY (county_id, tax_year, jurisdiction)
);

CREATE TABLE analysis (
  parcel_id bigint REFERENCES parcels(id) PRIMARY KEY,
  tax_year int NOT NULL,
  comp_count int,
  comp_quality text,
  median_comp_psf numeric,
  subject_psf numeric,
  pct_above numeric,
  implied_value numeric,
  gross_overassessment numeric,
  savings_case text,
  annual_savings numeric,
  comp_ids bigint[]
);

CREATE TABLE zip_stats (
  county_id int REFERENCES counties(id),
  tax_year int NOT NULL,
  situs_zip text NOT NULL,
  total_parcels int,
  pct_above_median numeric,
  avg_overassessment numeric,
  PRIMARY KEY (county_id, tax_year, situs_zip)
);

CREATE TABLE neighborhood_stats (
  county_id int REFERENCES counties(id),
  tax_year int NOT NULL,
  neighborhood_code text NOT NULL,
  total_parcels int,
  pct_above_median numeric,
  avg_overassessment numeric,
  PRIMARY KEY (county_id, tax_year, neighborhood_code)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id bigint REFERENCES parcels(id),
  email text NOT NULL,
  owner_name text,
  stripe_session_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  packet_path text,
  created_at timestamptz DEFAULT now(),
  delivered_at timestamptz
);
