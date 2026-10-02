import { pickStr } from "./runner";
import type { JobDetail } from "./shared-types";

/**
 * Per-portal "detail" support. Every portal CLI exposes
 * `bun run src/cli.ts detail <id> --format json` but each returns a
 * slightly different payload shape. This module maps portal id ->
 * CLI args + a normalizer that projects the payload into one
 * portal-agnostic JobDetail shape.
 */

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

const COOKIE_NOISE_PATTERNS: RegExp[] = [
  /cookie/i,
  /cookies/i,
  /samtykke/i,
  /accepter alle/i,
  /afvis alle/i,
  /cookiepolitik/i,
  /privatlivspolitik/i,
  /manage preferences/i,
  /consent/i,
  /gå til primært indhold/i,
  /go to main content/i,
  /vi benytter cookies/i,
  /this website uses/i,
  /du kan til enhver tid/i,
  // page chrome / CTAs scraped along with the posting
  /^ansøg\b/i,
  /^søg jobbet\b/i,
  /^del side/i,
  /^log ind\b/i,
  /^karrieremenu/i,
  /^(facebook|linkedin|mail|twitter|x)$/i,
  /^\d{1,2}\.\s*(januar|februar|marts|april|maj|juni|juli|august|september|oktober|november|december)\s*\d{4}$/i,
];

/**
 * Portal CLIs scrape live pages, so descriptions often start with
 * cookie-consent / navigation junk. Strip HTML, drop noisy lines and
 * collapse whitespace. Keeps the triage text readable.
 */
export function cleanDescription(raw: string | null): string | null {
  if (!raw) return null;
  let text = raw;
  // HTML payloads (jobnet "body") -> text
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ");
  // Decode the common HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&middot;/gi, "·")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&hellip;/gi, "…")
    .replace(/&aring;/gi, "å")
    .replace(/&aelig;/gi, "æ")
    .replace(/&oslash;/gi, "ø")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) && n > 31 && n < 0x10ffff ? String.fromCodePoint(n) : "";
    });
  // Drop junk lines and collapse whitespace
  let lines = text
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l.length > 0 && !COOKIE_NOISE_PATTERNS.some((re) => re.test(l)));
  // Scraped pages lead with nav/cookie junk made of short lines; the real
  // posting text is paragraphs. Trim the leading run of short lines up to
  // the first long line — but only when the trimmed prefix is a minority
  // of the text, so we never cut into the actual content.
  const firstLong = lines.findIndex((l) => l.length >= 60);
  if (firstLong > 0) {
    const removed = lines.slice(0, firstLong).join("\n").length;
    const total = lines.join("\n").length;
    if (total > 0 && removed / total < 0.5) lines = lines.slice(firstLong);
  }
  text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length > 12_000) text = `${text.slice(0, 12_000)}\n\n[… description truncated]`;
  return text.length > 0 ? text : null;
}

function sliceIso(v: string | null): string | null {
  if (!v) return null;
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : v;
}

/** Normalizers keyed by portal id. Unknown portals fall back to generic. */
const NORMALIZERS: Record<string, (payload: Record<string, unknown>) => JobDetail> = {
  jobindex: (p) => ({
    id: pickStr(p, ["id"]) ?? "",
    title: pickStr(p, ["title"]),
    company: pickStr(p, ["company"]),
    location: pickStr(p, ["location"]),
    date: sliceIso(pickStr(p, ["date"])),
    deadline: sliceIso(pickStr(p, ["deadline"])),
    url: pickStr(p, ["url"]),
    applyUrl: pickStr(p, ["applyUrl"]),
    employmentType: pickStr(p, ["employmentType"]),
    hours: pickStr(p, ["hours"]),
    description: cleanDescription(pickStr(p, ["description"])),
    notes: [],
  }),
  jobnet: (p) => {
    const employer = asRecord(p.employer);
    const job = asRecord(p.job);
    const address = asRecord(job.address);
    const application = asRecord(p.application);
    const locParts = [pickStr(address, ["city"]), pickStr(address, ["municipality"]), pickStr(address, ["countryName"])]
      .filter((v, i, a) => v && a.indexOf(v) === i);
    return {
      id: pickStr(p, ["id"]) ?? "",
      title: pickStr(p, ["title"]),
      company: pickStr(employer, ["name"]),
      location: locParts.length > 0 ? locParts.join(", ") : null,
      date: sliceIso(pickStr(p, ["publicationDateTime"])),
      deadline: sliceIso(pickStr(application, ["deadlineDate"])),
      url: pickStr(application, ["url"]),
      applyUrl: pickStr(application, ["url"]),
      employmentType: pickStr(job, ["type"]),
      hours: null,
      description: cleanDescription(pickStr(p, ["body"])),
      notes: [],
    };
  },
  linkedin: (p) => ({
    id: pickStr(p, ["id"]) ?? "",
    title: pickStr(p, ["title", "jobTitle"]),
    company: pickStr(p, ["company", "companyName"]),
    location: pickStr(p, ["location", "locationText"]),
    date: sliceIso(pickStr(p, ["date", "postedDate", "publishedDate"])),
    deadline: null,
    url: pickStr(p, ["url", "jobUrl", "absoluteUrl"]),
    applyUrl: pickStr(p, ["applyUrl"]),
    employmentType: pickStr(p, ["employmentType", "type"]),
    hours: null,
    description: cleanDescription(pickStr(p, ["description", "descriptionText", "body"])),
    notes: [],
  }),
  freehire: (p) => ({
    id: pickStr(p, ["id", "slug"]) ?? "",
    title: pickStr(p, ["title", "jobTitle"]),
    company: pickStr(p, ["company", "companyName", "employer"]),
    location: pickStr(p, ["location", "locationText"]),
    date: sliceIso(pickStr(p, ["date", "postedDate", "publishedDate"])),
    deadline: sliceIso(pickStr(p, ["deadline"])),
    url: pickStr(p, ["url", "jobUrl"]),
    applyUrl: pickStr(p, ["applyUrl"]),
    employmentType: pickStr(p, ["employmentType", "work_mode", "workMode"]),
    hours: null,
    description: cleanDescription(pickStr(p, ["description", "descriptionText", "body"])),
    notes: [],
  }),
};

/** Generic fallback used for jobbank + jobdanmark and any future portal. */
const genericNormalizer = (p: Record<string, unknown>): JobDetail => ({
  id: pickStr(p, ["id", "slug", "jobId", "jobAdId"]) ?? "",
  title: pickStr(p, ["title", "jobTitle", "name"]),
  company: pickStr(p, ["company", "companyName", "employer"]),
  location: pickStr(p, ["location", "locationText", "city"]),
  date: sliceIso(pickStr(p, ["date", "publishedDate", "postedDate"])),
  deadline: sliceIso(pickStr(p, ["deadline", "applicationDeadline", "deadlineDate"])),
  url: pickStr(p, ["url", "jobUrl", "link"]),
  applyUrl: pickStr(p, ["applyUrl", "applicationUrl"]),
  employmentType: pickStr(p, ["employmentType"]),
  hours: pickStr(p, ["hours"]),
  description: cleanDescription(pickStr(p, ["description", "descriptionText", "body"])),
  notes: [],
});

export function normalizeDetail(portalId: string, payload: unknown): JobDetail {
  const p = asRecord(payload);
  const normalizer = NORMALIZERS[portalId] ?? genericNormalizer;
  const detail = normalizer(p);
  if (!detail.description) {
    detail.notes.push("The portal returned no description text for this posting.");
  }
  return detail;
}

/** CLI args for the detail subcommand of each portal CLI. */
export function buildDetailArgs(portalId: string, jobId: string): string[] {
  return ["run", "src/cli.ts", "detail", jobId, "--format", "json"];
}
