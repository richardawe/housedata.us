import {
  PDFDocument, PDFPage, rgb, StandardFonts,
  type PDFFont,
} from "pdf-lib";
import https from "https";
import type { ParcelResult, CompRow } from "../db/queries";

const FORM_50_132_URL = "https://comptroller.texas.gov/forms/50-132.pdf";

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────
export async function generatePacketBytes(options: {
  parcel: ParcelResult;
  comps: CompRow[];
  ownerName: string;
  countyName: string;
  protestDeadline: string;
  efileUrl: string;
}): Promise<Uint8Array> {
  const { parcel, comps, ownerName, countyName, protestDeadline, efileUrl } = options;

  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  await addCoverPage(doc, { parcel, ownerName, countyName, helvetica, helveticaBold });
  await addCompsPage(doc, { parcel, comps, helvetica, helveticaBold });
  await addInstructionsPage(doc, { parcel, ownerName, countyName, protestDeadline, efileUrl, helvetica, helveticaBold });
  await appendForm50132(doc, { parcel, ownerName });

  return doc.save();
}

// ─────────────────────────────────────────────────────────────────────────────
// Page builders
// ─────────────────────────────────────────────────────────────────────────────

async function addCoverPage(
  doc: PDFDocument,
  { parcel, ownerName, countyName, helvetica, helveticaBold }: {
    parcel: ParcelResult;
    ownerName: string;
    countyName: string;
    helvetica: PDFFont;
    helveticaBold: PDFFont;
  }
) {
  const page = doc.addPage([612, 792]);
  let y = 750;

  function text(str: string, opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {}) {
    const { size = 11, bold = false, color = [0, 0, 0] } = opts;
    page.drawText(str, {
      x: 50, y,
      size,
      font: bold ? helveticaBold : helvetica,
      color: rgb(...color as [number, number, number]),
    });
    y -= size + 6;
  }

  function line() { y -= 8; }
  function rule() {
    page.drawLine({ start: { x: 50, y }, end: { x: 562, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 12;
  }

  text("PROPERTY TAX PROTEST EVIDENCE PACKET", { size: 16, bold: true });
  text(`${countyName} Appraisal Review Board`, { size: 12 });
  rule();

  text(`Property:`, { bold: true });
  text(parcel.situs_address);
  if (parcel.situs_city) text(`${parcel.situs_city}, TX ${parcel.situs_zip ?? ""}`);
  text(`Account #: ${parcel.account_id}`);
  text(`Tax year: ${parcel.tax_year}`);
  if (ownerName) { line(); text(`Owner: ${ownerName}`); }
  rule();

  text("ASSESSMENT SUMMARY", { size: 13, bold: true });
  line();

  if (parcel.market_value) text(`Current market (appraised) value:  $${fmt(parcel.market_value)}`);
  if (parcel.assessed_value) text(`Current taxable (assessed) value:  $${fmt(parcel.assessed_value)}`);
  if (parcel.implied_value) text(`Implied value (median of comps):   $${fmt(parcel.implied_value)}`);
  if (parcel.pct_above != null && parcel.pct_above > 0)
    text(`Assessed above median comp:        ${(parcel.pct_above * 100).toFixed(1)}%`);
  line();

  if (parcel.savings_case === "clear" && parcel.annual_savings) {
    text(`Estimated annual tax savings:  $${fmt(parcel.annual_savings)}`, { bold: true, color: [0, 0.5, 0] });
    text("(If ARB accepts the opinion of value below)");
  } else if (parcel.savings_case === "partial") {
    text("Homestead cap status: Cap protects current taxable value", { bold: true });
    text("Protest will lower your market value and reduce future assessment ceilings.");
    text("No change to this year's tax bill if ARB accepts comps.");
  } else if (parcel.savings_case === "capped") {
    text("Homestead cap status: Taxable value is protected by the homestead cap.", { bold: true });
    text("Protesting can lower your market value ceiling for future years,");
    text("but will not reduce this year's tax bill.");
  }

  line();
  text("OPINION OF VALUE", { size: 13, bold: true });
  line();
  text(`Based on the equity comps analysis on the following page, the`);
  text(`owner proposes an opinion of value of: $${fmt(parcel.implied_value ?? parcel.market_value ?? 0)}`, { bold: true });
  line();
  text(`This is supported by Texas Tax Code §41.43(b)(3), which entitles a property`);
  text(`owner to relief when the appraised value exceeds the median appraised value`);
  text(`of a reasonable number of comparable properties, appropriately adjusted.`);
  line();
  rule();
  text("Estimated values based on public appraisal district data. Not legal advice.", { size: 9, color: [0.5, 0.5, 0.5] });
}

async function addCompsPage(
  doc: PDFDocument,
  { parcel, comps, helvetica, helveticaBold }: {
    parcel: ParcelResult;
    comps: CompRow[];
    helvetica: PDFFont;
    helveticaBold: PDFFont;
  }
) {
  const page = doc.addPage([612, 792]);
  let y = 750;

  function text(str: string, opts: { x?: number; size?: number; bold?: boolean; color?: [number, number, number] } = {}) {
    const { x = 50, size = 10, bold = false, color = [0, 0, 0] } = opts;
    page.drawText(str, { x, y, size, font: bold ? helveticaBold : helvetica, color: rgb(...color as [number, number, number]) });
  }

  function row(y0: number, ...cells: Array<{ x: number; text: string; bold?: boolean }>) {
    for (const c of cells) {
      page.drawText(c.text, {
        x: c.x, y: y0, size: 9,
        font: c.bold ? helveticaBold : helvetica,
        color: rgb(0, 0, 0),
      });
    }
  }

  text("EQUITY COMPARABLE PROPERTIES", { size: 14, bold: true });
  y -= 20;

  text(`The following ${comps.length} properties are comparable to the subject property and`, { size: 10 });
  y -= 14;
  text("were used to compute the median appraised value per square foot.", { size: 10 });
  y -= 14;
  text(`Subject: ${parcel.situs_address} — ${parcel.living_sqft?.toFixed(0)} sqft, built ${parcel.year_built ?? "unknown"}`, { size: 10, bold: true });
  y -= 20;

  // Table header
  const cols = { acct: 50, addr: 115, sqft: 295, year: 345, value: 395, psf: 480 };
  const headerColor: [number, number, number] = [0.2, 0.2, 0.8];
  page.drawRectangle({ x: 46, y: y - 4, width: 520, height: 18, color: rgb(0.9, 0.92, 1) });
  row(y,
    { x: cols.acct, text: "Account #", bold: true },
    { x: cols.addr, text: "Address", bold: true },
    { x: cols.sqft, text: "Sqft", bold: true },
    { x: cols.year, text: "Yr Built", bold: true },
    { x: cols.value, text: "Appraised", bold: true },
    { x: cols.psf, text: "$/sqft", bold: true },
  );
  y -= 22;

  // All comps with subject inserted for comparison
  const subjectPsf = parcel.subject_psf ?? 0;
  const medianPsf = parcel.median_comp_psf ?? 0;

  for (const c of comps) {
    const isMedianRow = Math.abs((c.psf ?? 0) - medianPsf) < 0.5;
    if (isMedianRow) {
      page.drawRectangle({ x: 46, y: y - 4, width: 520, height: 16, color: rgb(0.9, 1, 0.9) });
    }
    row(y,
      { x: cols.acct, text: c.account_id.slice(-8), bold: isMedianRow },
      { x: cols.addr, text: c.situs_address.substring(0, 22) },
      { x: cols.sqft, text: c.living_sqft?.toFixed(0) ?? "—" },
      { x: cols.year, text: c.year_built?.toString() ?? "—" },
      { x: cols.value, text: c.market_value ? `$${fmt(c.market_value)}` : "—" },
      { x: cols.psf, text: c.psf ? `$${c.psf.toFixed(0)}` : "—", bold: isMedianRow },
    );
    y -= 16;
  }

  // Summary row
  y -= 8;
  page.drawLine({ start: { x: 50, y: y + 4 }, end: { x: 562, y: y + 4 }, thickness: 1, color: rgb(0.2, 0.2, 0.8) });
  y -= 6;
  row(y,
    { x: cols.acct, text: "MEDIAN", bold: true },
    { x: cols.value, text: "", bold: true },
    { x: cols.psf, text: `$${medianPsf.toFixed(0)}`, bold: true },
  );
  y -= 20;
  row(y,
    { x: cols.acct, text: "SUBJECT", bold: true },
    { x: cols.addr, text: (parcel.situs_address ?? "").substring(0, 22), bold: true },
    { x: cols.sqft, text: parcel.living_sqft?.toFixed(0) ?? "—", bold: true },
    { x: cols.value, text: parcel.market_value ? `$${fmt(parcel.market_value)}` : "—", bold: true },
    { x: cols.psf, text: `$${subjectPsf.toFixed(0)}`, bold: true },
  );
  y -= 30;

  // Implied value line
  text(`Implied value: median $/sqft ($${medianPsf.toFixed(0)}) × subject sqft (${parcel.living_sqft?.toFixed(0)}) = $${fmt(parcel.implied_value ?? 0)}`, { size: 10, bold: true });
  y -= 20;
  text("Argument (Texas Tax Code §41.43(b)(3)):", { size: 10, bold: true });
  y -= 14;
  text("The subject property's appraised value exceeds the median appraised value of", { size: 10 });
  y -= 13;
  text("a reasonable number of comparable properties when adjusted on a per-square-foot", { size: 10 });
  y -= 13;
  text("basis. The owner requests that the appraised value be reduced to the implied value", { size: 10 });
  y -= 13;
  text("shown above, which is consistent with equitable treatment under Texas law.", { size: 10 });
}

async function addInstructionsPage(
  doc: PDFDocument,
  { parcel, ownerName, countyName, protestDeadline, efileUrl, helvetica, helveticaBold }: {
    parcel: ParcelResult;
    ownerName: string;
    countyName: string;
    protestDeadline: string;
    efileUrl: string;
    helvetica: PDFFont;
    helveticaBold: PDFFont;
  }
) {
  const page = doc.addPage([612, 792]);
  let y = 750;

  function text(str: string, opts: { size?: number; bold?: boolean } = {}) {
    const { size = 11, bold = false } = opts;
    page.drawText(str, { x: 50, y, size, font: bold ? helveticaBold : helvetica, color: rgb(0, 0, 0) });
    y -= size + 6;
  }
  function line() { y -= 6; }

  text("FILING INSTRUCTIONS", { size: 14, bold: true });
  line();
  text(`County: ${countyName}`);
  text(`Deadline: ${protestDeadline}`, { bold: true });
  line();

  text("Step 1 — File your protest", { bold: true });
  text(`File online at: ${efileUrl}`);
  text("OR mail the completed Form 50-132 (attached) to:");
  text(`  ${countyName} Appraisal District`);
  line();

  text("Step 2 — Attach your evidence", { bold: true });
  text("Upload or bring this packet to your hearing. The comps table (page 2) is your");
  text("primary evidence. You may also bring photos or recent sales data.");
  line();

  text("Step 3 — Informal hearing", { bold: true });
  text("Most protests are resolved informally before a formal ARB hearing.");
  text("An appraiser will review your evidence and may offer a settlement.");
  text("Accept if it meets your goal; decline if you want a formal hearing.");
  line();

  text("What to say at your hearing:", { bold: true });
  text("\"I am protesting on the grounds of unequal appraisal under §41.43(b)(3).");
  text(`The attached equity comps table shows that ${parcel.comp_count ?? 0} comparable properties`);
  text(`in my neighborhood are assessed at a median of $${(parcel.median_comp_psf ?? 0).toFixed(0)}/sqft, while my property`);
  text("is assessed at a higher rate. I am requesting reduction to the implied value");
  text(`of $${fmt(parcel.implied_value ?? 0)}, which equals the median $/sqft times my living area."`);;
  line();

  text("Checklist before filing:", { bold: true });
  text("  [ ]  Form 50-132 signed and dated");
  text("  [ ]  Property account number matches your Notice of Appraised Value");
  text("  [ ]  Opinion of value filled in (use the implied value from page 1)");
  text("  [ ]  This comps packet attached");
  text("  [ ]  Filed before the deadline");
  line();

  if (ownerName) text(`Prepared for: ${ownerName}`);
  text("housedata.us — Not legal advice. No outcome guaranteed.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Form 50-132 fill
// ─────────────────────────────────────────────────────────────────────────────

async function appendForm50132(
  doc: PDFDocument,
  { parcel, ownerName }: { parcel: ParcelResult; ownerName: string }
): Promise<void> {
  let formBytes: Uint8Array;
  try {
    formBytes = await downloadUrl(FORM_50_132_URL);
  } catch {
    // If form can't be downloaded, add a placeholder page
    const placeholder = doc.addPage([612, 792]);
    placeholder.drawText("Form 50-132 could not be downloaded. Please obtain from:", { x: 50, y: 700, size: 11 });
    placeholder.drawText(FORM_50_132_URL, { x: 50, y: 682, size: 11 });
    return;
  }

  const formDoc = await PDFDocument.load(formBytes, { ignoreEncryption: true });

  // Field names verified by inspecting the live form via:
  //   pdfDoc.getForm().getFields().map(f => f.getName())
  try {
    const form = formDoc.getForm();

    const fill = (name: string, value: string) => {
      try { form.getTextField(name).setText(value); } catch { /* field may not exist in all versions */ }
    };

    const check = (name: string) => {
      try { form.getCheckBox(name).check(); } catch { /* skip */ }
    };

    fill("Name of Property Owner or Lessee", ownerName);
    fill("Appraisal District Account Number", parcel.account_id);
    fill("Physical Address", parcel.situs_address);
    fill("Appraisal Districts Name", "Travis Central Appraisal District");
    fill("Tax Year", String(parcel.tax_year));
    fill("Opinion of property value",
      String(Math.round(parcel.implied_value ?? parcel.market_value ?? 0)));
    fill("Appraisal districts value assigned to property",
      String(Math.round(parcel.market_value ?? 0)));
    fill("Print Name of Property Owner or Authorized Representative", ownerName);

    // Protest reasons:
    //   Reason for protest 1 = value is over market value (incorrect appraised value)
    //   Reason for protest 2 = unequal appraisal compared to comparable properties
    check("Reason for protest 1");
    check("Reason for protest 2");

  } catch {
    // Field filling failed — form is still appended blank for manual completion
  }

  const pages = await doc.copyPages(formDoc, formDoc.getPageIndices());
  for (const p of pages) doc.addPage(p);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function downloadUrl(url: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
      res.on("error", reject);
    }).on("error", reject);
  });
}
