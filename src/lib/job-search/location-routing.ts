/**
 * Location-aware search routing — fixes the "wrong country results" bug.
 *
 * Problem: the four Danish portal CLIs (jobindex, jobnet, jobbank,
 * jobdanmark) have no location parameter at all, and freehire only
 * filters by an ISO-3166 country code. Searching "Lahore, Pakistan"
 * therefore used to return Danish postings from every Danish board.
 *
 * Solution:
 *  1. parseLocation() extracts city + country (with aliases/demonyms)
 *     and resolves an ISO-3166 alpha-2 code, also from a curated
 *     major-city map when the user only typed a city name.
 *  2. planLocationSearch() routes the fan-out: Denmark-only boards are
 *     skipped (with an honest, per-board reason) unless the location is
 *     Danish, freehire gets --country <ISO2>, LinkedIn always geocodes.
 *  3. guardJobsByLocation() is the defense-in-depth result filter: any
 *     job whose location clearly names a DIFFERENT country/major city
 *     is dropped and counted, so leaked postings never reach the UI.
 */

export interface ParsedLocation {
  raw: string;
  /** First segment, e.g. "Lahore" from "Lahore, Pakistan". */
  city: string | null;
  /** Resolved country display name, e.g. "Pakistan". */
  country: string | null;
  /** ISO-3166 alpha-2 code, e.g. "PK". */
  countryCode: string | null;
  isRemote: boolean;
  isDenmark: boolean;
  /**
   * none        — no location typed (app defaults to Copenhagen, Denmark)
   * denmark     — a Danish location
   * remote      — "Remote" / "Anywhere" / "Work from home"
   * international — city+country resolved outside Denmark
   * unresolved  — free text we could not map to a country (city only)
   */
  mode: "none" | "denmark" | "remote" | "international" | "unresolved";
}

export interface SkippedPortal {
  portalId: string;
  name: string;
  reason: string;
}

/** Country names/aliases/demonyms (lowercase) → ISO-3166 alpha-2. */
const COUNTRY_CODES: Record<string, string> = {
  // Denmark first — it is this toolkit's home market.
  denmark: "DK", danmark: "DK", danish: "DK", dansk: "DK", dk: "DK",
  // Common aliases + demonyms
  "united states": "US", usa: "US", us: "US", u_s_a: "US", america: "US", "united states of america": "US", american: "US",
  "united kingdom": "GB", uk: "GB", britain: "GB", "great britain": "GB", england: "GB", scotland: "GB", wales: "GB", "northern ireland": "GB", british: "GB",
  "united arab emirates": "AE", uae: "AE", emirati: "AE",
  germany: "DE", deutsch: "DE", german: "DE", deutschland: "DE",
  france: "FR", french: "FR",
  spain: "ES", spanish: "ES",
  italy: "IT", italian: "IT",
  netherlands: "NL", holland: "NL", dutch: "NL",
  belgium: "BE", belgian: "BE",
  sweden: "SE", swedish: "SE",
  norway: "NO", norwegian: "NO",
  finland: "FI", finnish: "FI",
  iceland: "IS", icelandic: "IS",
  switzerland: "CH", swiss: "CH",
  austria: "AT", austrian: "AT",
  poland: "PL", polish: "PL",
  portugal: "PT", portuguese: "PT",
  ireland: "IE", irish: "IE",
  "czech republic": "CZ", czechia: "CZ", czech: "CZ",
  greece: "GR", greek: "GR",
  romania: "RO", romanian: "RO",
  hungary: "HU", hungarian: "HU",
  ukraine: "UA", ukrainian: "UA",
  turkey: "TR", turkiye: "TR", turkish: "TR",
  russia: "RU", russian: "RU",
  india: "IN", indian: "IN",
  pakistan: "PK", pakistani: "PK",
  bangladesh: "BD", bangladeshi: "BD",
  "sri lanka": "LK", srilankan: "LK",
  nepal: "NP", nepali: "NP",
  china: "CN", chinese: "CN",
  japan: "JP", japanese: "JP",
  "south korea": "KR", korea: "KR", korean: "KR",
  singapore: "SG",
  malaysia: "MY", malaysian: "MY",
  indonesia: "ID", indonesian: "ID",
  thailand: "TH", thai: "TH",
  vietnam: "VN", vietnamese: "VN",
  philippines: "PH", filipino: "PH",
  australia: "AU", australian: "AU",
  "new zealand": "NZ",
  canada: "CA", canadian: "CA",
  brazil: "BR", brazilian: "BR",
  mexico: "MX", mexican: "MX",
  argentina: "AR", argentine: "AR",
  chile: "CL",
  colombia: "CO", colombian: "CO",
  "south africa": "ZA",
  nigeria: "NG", nigerian: "NG",
  kenya: "KE",
  egypt: "EG", egyptian: "EG",
  morocco: "MA", moroccan: "MA",
  "saudi arabia": "SA", saudi: "SA", ksa: "SA",
  qatar: "QA",
  kuwait: "KW",
  bahrain: "BH",
  oman: "OM", omani: "OM",
  jordan: "JO",
  israel: "IL",
  iran: "IR",
  iraq: "IQ",
  afghanistan: "AF",
  uzbekistan: "UZ",
  kazakhstan: "KZ",
  georgia: "GE",
  armenia: "AM",
  azerbaijan: "AZ",
  slovakia: "SK", slovak: "SK",
  slovenia: "SI",
  croatia: "HR", croatian: "HR",
  serbia: "RS",
  bulgaria: "BG", bulgarian: "BG",
  estonia: "EE",
  latvia: "LV",
  lithuania: "LT",
  albania: "AL",
  "bosnia and herzegovina": "BA", bosnia: "BA",
  "north macedonia": "MK", macedonia: "MK",
  moldova: "MD",
  belarus: "BY",
  luxembourg: "LU",
  malta: "MT",
  cyprus: "CY",
  monaco: "MC",
  "puerto rico": "PR",
  "costa rica": "CR",
  panama: "PA",
  uruguay: "UY",
  paraguay: "PY",
  bolivia: "BO",
  peru: "PE",
  ecuador: "EC",
  venezuela: "VE",
  honduras: "HN",
  guatemala: "GT",
  "el salvador": "SV",
  nicaragua: "NI",
  cuba: "CU",
  "dominican republic": "DO",
  jamaica: "JM",
  "trinidad and tobago": "TT",
  ethiopia: "ET",
  ghana: "GH",
  tanzania: "TZ",
  uganda: "UG",
  zimbabwe: "ZW",
  zambia: "ZM",
  botswana: "BW",
  namibia: "NA",
  tunisia: "TN",
  algeria: "DZ",
  libya: "LY",
  sudan: "SD",
  senegal: "SN",
  "cote d'ivoire": "CI", "ivory coast": "CI",
  cameroon: "CM",
  angola: "AO",
  mozambique: "MZ",
  rwanda: "RW",
  maldives: "MV",
  brunei: "BN",
  cambodia: "KH",
  laos: "LA",
  myanmar: "MM", burma: "MM",
  mongolia: "MN",
  "hong kong": "HK",
  taiwan: "TW",
  macau: "MO",
  fiji: "FJ",
  "papua new guinea": "PG",
};

/** Major cities → ISO-2, used when the location has no country suffix. */
/** Multi-word keys are underscore-normalized (spaces are stripped before lookup). */
const CITY_CODES: Record<string, string> = {
  // Denmark (so "Copenhagen"/"Aarhus" alone still routes as Denmark)
  copenhagen: "DK", københavn: "DK", kobenhavn: "DK", aarhus: "DK", århus: "DK", arhus: "DK",
  odense: "DK", aalborg: "DK", ålborg: "DK", esbjerg: "DK", randers: "DK", kolding: "DK",
  horsens: "DK", vejle: "DK", roskilde: "DK", herning: "DK", slagelse: "DK", lyngby: "DK",
  // Pakistan
  lahore: "PK", karachi: "PK", islamabad: "PK", rawalpindi: "PK", faisalabad: "PK",
  multan: "PK", peshawar: "PK", quetta: "PK", sialkot: "PK", gujranwala: "PK",
  hyderabad: "PK", abbottabad: "PK", sargodha: "PK", bahawalpur: "PK", "sahiwal": "PK",
  // Rest of world (major job markets)
  london: "GB", manchester: "GB", birmingham: "GB", glasgow: "GB", edinburgh: "GB", dublin: "IE",
  new_york: "US", boston: "US", chicago: "US", san_francisco: "US", seattle: "US",
  austin: "US", los_angeles: "US", denver: "US", miami: "US", atlanta: "US", dallas: "US",
  toronto: "CA", vancouver: "CA", montreal: "CA", ottawa: "CA", calgary: "CA",
  berlin: "DE", munich: "DE", hamburg: "DE", frankfurt: "DE", cologne: "DE",
  paris: "FR", lyon: "FR", toulouse: "FR", marseille: "FR",
  amsterdam: "NL", rotterdam: "NL", the_hague: "NL", eindhoven: "NL", utrecht: "NL",
  brussels: "BE", antwerp: "BE", zurich: "CH", geneva: "CH", basel: "CH", vienna: "AT",
  stockholm: "SE", gothenburg: "SE", malmö: "SE", malmo: "SE", oslo: "NO", bergen: "NO",
  helsinki: "FI", reykjavik: "IS", warsaw: "PL", krakow: "PL", prague: "CZ", budapest: "HU",
  bucharest: "RO", sofia: "BG", athens: "GR", lisbon: "PT", porto: "PT", madrid: "ES",
  barcelona: "ES", valencia: "ES", milan: "IT", rome: "IT", turin: "IT", tallinn: "EE",
  riga: "LV", vilnius: "LT", moscow: "RU", "saint petersburg": "RU", kyiv: "UA", kiev: "UA",
  istanbul: "TR", ankara: "TR", dubai: "AE", abu_dhabi: "AE", sharjah: "AE", doha: "QA",
  riyadh: "SA", jeddah: "SA", dammam: "SA", kuwait_city: "KW", manama: "BH", muscat: "OM",
  amman: "JO", beirut: "LB", cairo: "EG", casablanca: "MA", nairobi: "KE", lagos: "NG",
  cape_town: "ZA", johannesburg: "ZA", durban: "ZA", mumbai: "IN", delhi: "IN",
  bangalore: "IN", bengaluru: "IN", chennai: "IN", pune: "IN",
  dhaka: "BD", colombo: "LK", kathmandu: "NP", beijing: "CN", shanghai: "CN", shenzhen: "CN",
  hongkong: "HK", taipei: "TW", tokyo: "JP", osaka: "JP", seoul: "KR",
  kuala_lumpur: "MY", jakarta: "ID", bangkok: "TH", ho_chi_minh: "VN", hanoi: "VN",
  manila: "PH", sydney: "AU", melbourne: "AU", brisbane: "AU", perth: "AU",
  auckland: "NZ", wellington: "NZ", sao_paulo: "BR",
  rio_de_janeiro: "BR", buenos_aires: "AR", mexico_city: "MX", santiago: "CL",
  bogota: "CO", lima: "PE", tel_aviv: "IL", tashkent: "UZ", baku: "AZ",
  tbilisi: "GE", yerevan: "AM", almaty: "KZ", yangon: "MM", phnom_penh: "KH", ulaanbaatar: "MN",
};

/** ISO-2 → display name for the resolved country (subset that matters here). */
const ISO_NAMES: Record<string, string> = {
  DK: "Denmark", US: "United States", GB: "United Kingdom", AE: "United Arab Emirates",
  DE: "Germany", FR: "France", ES: "Spain", IT: "Italy", NL: "Netherlands", BE: "Belgium",
  SE: "Sweden", NO: "Norway", FI: "Finland", IS: "Iceland", CH: "Switzerland", AT: "Austria",
  PL: "Poland", PT: "Portugal", IE: "Ireland", CZ: "Czechia", GR: "Greece", RO: "Romania",
  HU: "Hungary", UA: "Ukraine", TR: "Türkiye", RU: "Russia", IN: "India", PK: "Pakistan",
  BD: "Bangladesh", LK: "Sri Lanka", NP: "Nepal", CN: "China", JP: "Japan", KR: "South Korea",
  SG: "Singapore", MY: "Malaysia", ID: "Indonesia", TH: "Thailand", VN: "Vietnam",
  PH: "Philippines", AU: "Australia", NZ: "New Zealand", CA: "Canada", BR: "Brazil",
  MX: "Mexico", AR: "Argentina", CL: "Chile", CO: "Colombia", ZA: "South Africa",
  NG: "Nigeria", KE: "Kenya", EG: "Egypt", MA: "Morocco", SA: "Saudi Arabia", QA: "Qatar",
  KW: "Kuwait", BH: "Bahrain", OM: "Oman", JO: "Jordan", IL: "Israel", IR: "Iran",
  IQ: "Iraq", AF: "Afghanistan", UZ: "Uzbekistan", KZ: "Kazakhstan", GE: "Georgia",
  AM: "Armenia", AZ: "Azerbaijan", SK: "Slovakia", SI: "Slovenia", HR: "Croatia",
  RS: "Serbia", BG: "Bulgaria", EE: "Estonia", LV: "Latvia", LT: "Lithuania",
  AL: "Albania", BA: "Bosnia and Herzegovina", MK: "North Macedonia", MD: "Moldova",
  BY: "Belarus", LU: "Luxembourg", MT: "Malta", CY: "Cyprus", TW: "Taiwan", HK: "Hong Kong",
  MV: "Maldives", BN: "Brunei", KH: "Cambodia", LA: "Laos", MM: "Myanmar", MN: "Mongolia",
};

const DANISH_BOARD_IDS = ["jobindex", "jobnet", "jobbank", "jobdanmark"] as const;

const REMOTE_RE = /^(remote|anywhere|work\s*from\s*home|wfh|home\s*office|fully\s*remote|remote\s*only)$/i;

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countryName(iso2: string): string | null {
  return ISO_NAMES[iso2.toUpperCase()] ?? null;
}

/**
 * Parse a free-text location into city/country/ISO2 and classify the mode.
 * Never throws — worst case it returns mode "unresolved" and callers route
 * conservatively (LinkedIn only, which geocodes server-side).
 */
export function parseLocation(raw: string): ParsedLocation {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { raw: "", city: null, country: null, countryCode: null, isRemote: false, isDenmark: true, mode: "none" };
  }
  if (REMOTE_RE.test(trimmed)) {
    return { raw: trimmed, city: null, country: null, countryCode: null, isRemote: true, isDenmark: false, mode: "remote" };
  }

  const segments = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  const normSegments = segments.map(normalizeKey);

  let city: string | null = segments.length > 1 ? segments[0] : null;
  let countryCode: string | null = null;

  // Scan segments right-to-left so "Lahore, Punjab, Pakistan" resolves PK.
  for (let i = normSegments.length - 1; i >= 0; i--) {
    const seg = normSegments[i];
    const direct = COUNTRY_CODES[seg] ?? COUNTRY_CODES[seg.replace(/\s/g, "_")];
    if (direct) {
      countryCode = direct;
      break;
    }
  }
  // Fall back to the major-city map (any segment) when no country name matched.
  if (!countryCode) {
    for (let i = normSegments.length - 1; i >= 0; i--) {
      const seg = normSegments[i].replace(/\s/g, "_");
      const byCity = CITY_CODES[seg] ?? CITY_CODES[seg.replace(/_/g, "")];
      if (byCity) {
        countryCode = byCity;
        if (!city) city = segments[i];
        break;
      }
    }
  }

  const isDenmark = countryCode === "DK";
  const mode: ParsedLocation["mode"] = countryCode
    ? isDenmark
      ? "denmark"
      : "international"
    : "unresolved";

  return {
    raw: trimmed,
    city,
    country: countryCode ? countryName(countryCode) : null,
    countryCode,
    isRemote: false,
    isDenmark,
    mode,
  };
}

/** Word-boundary-safe containment test. */
function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i").test(haystack);
}

export interface LocationPlan {
  include: string[];
  skipped: SkippedPortal[];
}

/**
 * Decide which portals can honor the parsed location.
 * DK boards are Denmark-only by design — running them for a foreign city
 * is exactly what produced wrong-country results, so they are skipped
 * with an honest reason the UI can display.
 */
export function planLocationSearch(parsed: ParsedLocation): LocationPlan {
  const allIds = [...DANISH_BOARD_IDS, "linkedin", "freehire"];
  if (parsed.mode === "none" || parsed.mode === "denmark") {
    return { include: allIds, skipped: [] };
  }

  const skipped: SkippedPortal[] = [];
  const skipDanish = () => {
    for (const id of DANISH_BOARD_IDS) {
      skipped.push({
        portalId: id,
        reason:
          parsed.mode === "remote"
            ? "Denmark-only board — a Remote search cannot be scoped to Denmark. Pick this board explicitly to search it anyway."
            : `Lists jobs in Denmark only — your “${parsed.raw}” search cannot be applied here.`,
      });
    }
  };

  if (parsed.mode === "remote") {
    skipDanish();
    return { include: ["linkedin", "freehire"], skipped };
  }

  // International / unresolved
  skipDanish();
  const include = ["linkedin"];
  if (parsed.mode === "international" && parsed.countryCode) {
    include.push("freehire"); // gets --country <ISO2> in buildArgs
  } else {
    skipped.push({
      portalId: "freehire",
      reason: `Filtered by country, but no country was recognized in “${parsed.raw}”. Include a country name (e.g. “Lahore, Pakistan”) to search Freehire.`,
    });
  }
  return { include, skipped };
}

export interface LocationGuardResult {
  jobs: NormalizedJobLike[];
  hidden: number;
}

interface NormalizedJobLike {
  location?: string | null;
  [k: string]: unknown;
}

/**
 * Defense-in-depth result filter for concrete international searches:
 * drop jobs whose location clearly names a DIFFERENT country or major
 * city. Jobs with no location, a "remote" marker, the requested city or
 * the requested country always pass; unrecognized free text passes too
 * (portal-level routing already did the heavy lifting).
 */
export function guardJobsByLocation(jobs: NormalizedJobLike[], parsed: ParsedLocation): LocationGuardResult {
  if (parsed.mode !== "international" || !parsed.countryCode) {
    return { jobs, hidden: 0 };
  }
  const requestedCountry = parsed.countryCode;
  const requestedCountryName = parsed.country ? normalizeKey(parsed.country) : null;
  const requestedCity = parsed.city ? normalizeKey(parsed.city) : null;

  const kept: NormalizedJobLike[] = [];
  let hidden = 0;
  for (const job of jobs) {
    const loc = typeof job.location === "string" ? normalizeKey(job.location) : "";
    if (!loc || /remote|anywhere|work from home|wfh/.test(loc)) {
      kept.push(job);
      continue;
    }
    if (requestedCity && containsWord(loc, requestedCity)) {
      kept.push(job);
      continue;
    }
    if (requestedCountryName && containsWord(loc, requestedCountryName)) {
      kept.push(job);
      continue;
    }
    // Does the location name a known place in a DIFFERENT country?
    let foreign = false;
    for (const [name, code] of Object.entries(COUNTRY_CODES)) {
      if (code !== requestedCountry && name.length >= 4 && containsWord(loc, name)) {
        foreign = true;
        break;
      }
    }
    if (!foreign) {
      const locKey = loc.replace(/\s/g, "_");
      for (const [cityName, code] of Object.entries(CITY_CODES)) {
        if (code !== requestedCountry && cityName.length >= 4 && (locKey === cityName || containsWord(loc, cityName.replace(/_/g, " ")))) {
          foreign = true;
          break;
        }
      }
    }
    if (foreign) {
      hidden++;
      continue;
    }
    kept.push(job);
  }
  return { jobs: kept, hidden };
}
