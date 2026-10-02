/**
 * Danish → English glossary for portal metadata strings that surface in the
 * UI (jobnet employment types like "Almindelige vilkår" / "Ordinært", hours,
 * extra chips). We render the English translation and keep the original
 * Danish available in a tooltip, so the Control Center stays readable for
 * non-Danish speakers without hiding the source data.
 */

/** Exact-value map after normalizing (lowercase, collapsed whitespace). */
const EXACT: Record<string, string> = {
  "almindelige vilkaar": "Standard terms",
  "almindelige vilkår": "Standard terms",
  "ordinært": "Standard employment",
  "ordinaert": "Standard employment",
  "fastansættelse": "Permanent contract",
  "fastansaettelse": "Permanent contract",
  "fuldtid": "Full time",
  "deltid": "Part time",
  "vikariat": "Temporary position",
  "timelønnet": "Hourly paid",
  "timeloenncet": "Hourly paid",
  "hjemmearbejde": "Remote work",
  "arbejde hjemmefra": "Work from home",
  "midlertidigt": "Temporary",
  "fleksibelt": "Flexible",
  "ansøgningsfrist": "Application deadline",
  "ansoegningsfrist": "Application deadline",
  "skiftende vilkår": "Varying terms",
  "skiftende vilkaar": "Varying terms",
  "ledig stilling": "Open position",
  "praktikplads": "Internship",
  "lærling": "Apprentice",
  "laering": "Apprentice",
};

/**
 * jobdanmark's top-level category titles (from its live `categories` listing)
 * — exact matches so Discover bars render English without mangling anything.
 */
const TAXONOMY_EXACT: Record<string, string> = {
  "håndværk, industri, transport og landbrug": "Crafts, industry, transport & agriculture",
  "handvaerk, industri, transport og landbrug": "Crafts, industry, transport & agriculture",
  "pleje, social og sundhed": "Care, social & health",
  "pædagogik, uddannelse og forskning": "Education, teaching & research",
  "paedagogik, uddannelse og forskning": "Education, teaching & research",
  "hotel, service, restauration og sikkerhed": "Hotel, service, restaurant & security",
  "salg, kommunikation, marketing, og design": "Sales, communication, marketing & design",
  "salg, kommunikation, marketing og design": "Sales, communication, marketing & design",
  "ledelse, hr og projektstyring": "Management, HR & project leadership",
  "kontor, finans og økonomi": "Office, finance & economics",
  "kontor, finans og oekonomi": "Office, finance & economics",
  "øvrige job": "Other jobs",
  "ovrige job": "Other jobs",
  "it, ingeniør og energi": "IT, engineering & energy",
  "it, ingenioer og energi": "IT, engineering & energy",
  "kirke, kultur og underholdning": "Church, culture & entertainment",
};

/** Word-level replacements for mixed strings like "Fuldtid · 37 timer/uge". */
const WORDS: [RegExp, string][] = [
  [/\bfuldtid(s)?\b/giu, "Full time"],
  [/\bdeltid(s)?\b/giu, "Part time"],
  [/\bvikariat\b/giu, "Temporary position"],
  [/\bfastansættelse\b/giu, "Permanent contract"],
  [/\btimer\/uge\b/giu, "hours/week"],
  [/\bpr\. time\b/giu, "per hour"],
  [/\bhjemmearbejde\b/giu, "Remote work"],
  [/\barbejde hjemmefra\b/giu, "Work from home"],
  [/\bansøgningsfrist\b/giu, "Application deadline"],
  // Taxonomy example words (jobdanmark category help texts, ESCO aliases).
  // NOTE: JS \b is ASCII-only — words ending in æ/ø/å use a lookahead
  // boundary instead, otherwise "miljø"/"anlæg" would never match.
  [/\blager\b/giu, "warehouse"],
  [/\bbyggeri\b/giu, "construction"],
  [/\bproduktion\b/giu, "production"],
  [/\bfødevare(r)?\b/giu, "food"],
  [/\bsocialrådgiver\b/giu, "social worker"],
  [/\blæge(r)?\b/giu, "physician"],
  [/\bsygeplejerske(r)?\b/giu, "nurse"],
  [/\bomsorgspleje\b/giu, "foster care"],
  [/\bundervisning\b/giu, "teaching"],
  [/\bvejledning\b/giu, "counselling"],
  [/\bforskning\b/giu, "research"],
  [/\brengøring\b/giu, "cleaning"],
  [/\bfrisør\b/giu, "hairdresser"],
  [/\bvagt\b/giu, "guarding"],
  [/\bbud\b/giu, "courier"],
  [/\bsalg\b/giu, "sales"],
  [/\bmarkedsføring\b/giu, "marketing"],
  [/\bgrafisk\b/giu, "graphic design"],
  [/\bjournalistik\b/giu, "journalism"],
  [/\bledelse\b/giu, "management"],
  [/\bpersonale\b/giu, "HR"],
  [/\brekruttering\b/giu, "recruitment"],
  [/\bprojektledelse\b/giu, "project management"],
  [/\bjura\b/giu, "law"],
  [/\bregnskab\b/giu, "accounting"],
  [/\btolk\b/giu, "interpreting"],
  [/\belev(er)?\b/giu, "apprentice"],
  [/\bpraktik\b/giu, "internship"],
  [/\bfritidsjob\b/giu, "after-school job"],
  [/\bandre\b/giu, "other"],
  [/\berhverv\b/giu, "trades"],
  [/\budvikling\b/giu, "development"],
  [/\bteknik\b/giu, "engineering"],
  [/\bpædagogik\b/giu, "pedagogy"],
  [/\bkunst\b/giu, "art"],
  [/\bmiljø(?![a-zæøå])/giu, "environment"],
  [/\banlæg(?![a-zæøå])/giu, "civil works"],
  [/\bbegravelse\b/giu, "funerals"],
];

/**
 * Word-level replacements for common Danish occupation titles (jobnet's ESCO
 * index). Conservative on purpose — only unambiguous titles translate.
 */
const OCCUPATION_EXACT: Record<string, string> = {
  "udvikler": "Developer",
  "softwareudvikler": "Software developer",
  "sygeplejerske": "Nurse",
  "lærer": "Teacher",
  "pædagog": "Pedagogue / childcare worker",
  "elektriker": "Electrician",
  "tømrer": "Carpenter",
  "murer": "Bricklayer",
  "kok": "Chef",
  "frisør": "Hairdresser",
  "chauffør": "Driver",
  "sælger": "Salesperson",
  "konsulent": "Consultant",
  "rengøringsassistent": "Cleaning assistant",
  "sosu-assistent": "Healthcare assistant",
  "vvs-installatør": "Plumbing installer",
  "datakoordinator": "Data coordinator",
  "projektleder": "Project manager",
  "økonomiassistent": "Finance assistant",
  "kontorassistent": "Office assistant",
};

function normalize(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface DanishTranslation {
  text: string;
  /** True when we substituted at least one Danish phrase. */
  translated: boolean;
}

/**
 * Translate known Danish terms in a metadata string. Unknown values pass
 * through untouched (translated: false) so nothing is silently mangled.
 */
export function translateDanish(value: string | null | undefined): DanishTranslation {
  if (!value) return { text: "", translated: false };
  const key = normalize(value);
  const exact = EXACT[key] ?? TAXONOMY_EXACT[key] ?? OCCUPATION_EXACT[key];
  if (exact) return { text: exact, translated: true };

  let out = value;
  let hit = false;
  for (const [re, en] of WORDS) {
    if (re.test(out)) {
      out = out.replace(re, en);
      hit = true;
    }
  }
  return hit ? { text: out, translated: true } : { text: value, translated: false };
}
