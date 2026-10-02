"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Client-side fit triage, inspired by the repo's /rank workflow.
 *
 * The real /rank is an agent workflow: it batch-fetches posting pages and
 * scores them against the candidate profile with an LLM rubric
 * (technical / experience / behavioral / career). This hook is a
 * lightweight *metadata triage*: it scores titles/companies/locations from
 * the live search results against a user-editable keyword profile, so the
 * shortlist stars and sorting have some signal. It is a heuristic, not the
 * framework's scoring — full scoring stays in the repo's /apply.
 */

export interface FitProfile {
  /** Skills/keywords that should appear in a good match, most important first. */
  skills: string[];
  /** Keywords that veto a posting (never apply). */
  dealBreakers: string[];
  /** Preferred locations (substring match against the job location). */
  locations: string[];
  /** Bonus for remote-friendly postings. */
  remoteFriendly: boolean;
  updatedAt: string | null;
}

export const DEFAULT_PROFILE: FitProfile = {
  skills: ["python", "developer", "engineer"],
  dealBreakers: [],
  locations: [],
  remoteFriendly: true,
  updatedAt: null,
};

const STORAGE_KEY = "aijs.fitprofile.v1";

export interface FitResult {
  score: number | null;
  band: "strong" | "good" | "fair" | "weak" | "veto" | "unrated";
  matchedSkills: string[];
  matchedLocation: string | null;
  vetoedBy: string | null;
}

export function scoreJob(profile: FitProfile, job: { title: string; company: string | null; location: string | null; extra: string | null }): FitResult {
  const skills = profile.skills.map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (skills.length === 0) {
    return { score: null, band: "unrated", matchedSkills: [], matchedLocation: null, vetoedBy: null };
  }
  const haystack = [job.title, job.company, job.location, job.extra]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const locHaystack = `${job.location ?? ""} ${job.extra ?? ""}`.toLowerCase();

  const veto = profile.dealBreakers.map((d) => d.trim().toLowerCase()).filter(Boolean).find((d) => haystack.includes(d));
  if (veto) {
    return { score: 0, band: "veto", matchedSkills: [], matchedLocation: null, vetoedBy: veto };
  }

  const matchedSkills = skills.filter((s) => haystack.includes(s));
  const ratio = matchedSkills.length / skills.length;

  const matchedLocation = profile.locations.map((l) => l.trim().toLowerCase()).filter(Boolean).find((l) => locHaystack.includes(l)) ?? null;

  let score = Math.round(20 + ratio * 65);
  if (matchedLocation) score += 8;
  if (profile.remoteFriendly && /\bremote\b|arbejde hjemmefra|hjemmearbejde/i.test(haystack)) score += 7;
  // First three skills are "most important" — small bonus when they hit.
  const coreHit = matchedSkills.filter((s) => skills.indexOf(s) < 3).length;
  score += Math.min(coreHit * 2, 6);
  score = Math.max(0, Math.min(100, score));

  const band: FitResult["band"] = score >= 80 ? "strong" : score >= 60 ? "good" : score >= 40 ? "fair" : "weak";
  return { score, band, matchedSkills, matchedLocation, vetoedBy: null };
}

export function loadProfile(): FitProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<FitProfile>;
    return {
      skills: Array.isArray(parsed.skills) ? parsed.skills.filter((s) => typeof s === "string").slice(0, 30) : DEFAULT_PROFILE.skills,
      dealBreakers: Array.isArray(parsed.dealBreakers) ? parsed.dealBreakers.filter((s) => typeof s === "string").slice(0, 20) : [],
      locations: Array.isArray(parsed.locations) ? parsed.locations.filter((s) => typeof s === "string").slice(0, 10) : [],
      remoteFriendly: typeof parsed.remoteFriendly === "boolean" ? parsed.remoteFriendly : true,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

/** Hydration-safe profile hook (same pattern as the shortlist context). */
export function useFitProfile() {
  const [profile, setProfile] = useState<FitProfile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Hydrate from localStorage after mount — must not run during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(loadProfile());
    setHydrated(true);
  }, []);

  const save = useCallback((next: FitProfile) => {
    const withMeta = { ...next, updatedAt: new Date().toISOString() };
    setProfile(withMeta);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(withMeta));
    } catch {
      // localStorage unavailable (private mode) — keep in-memory only
    }
  }, []);

  const reset = useCallback(() => {
    setProfile(DEFAULT_PROFILE);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { profile, hydrated, save, reset };
}

export const FIT_BAND_STYLES: Record<FitResult["band"], { label: string; className: string; dot: string }> = {
  strong: { label: "Strong fit", className: "text-emerald-700 dark:text-emerald-300 border-emerald-600/30 bg-emerald-600/10 dark:bg-emerald-400/10", dot: "bg-emerald-500" },
  good: { label: "Good fit", className: "text-teal-700 dark:text-teal-300 border-teal-600/30 bg-teal-600/10 dark:bg-teal-400/10", dot: "bg-teal-500" },
  fair: { label: "Fair fit", className: "text-amber-700 dark:text-amber-300 border-amber-600/30 bg-amber-600/10 dark:bg-amber-400/10", dot: "bg-amber-500" },
  weak: { label: "Weak fit", className: "text-rose-700 dark:text-rose-300 border-rose-600/30 bg-rose-600/10 dark:bg-rose-400/10", dot: "bg-rose-500" },
  veto: { label: "Deal-breaker", className: "text-rose-700 dark:text-rose-300 border-rose-600/40 bg-rose-600/15 dark:bg-rose-400/15", dot: "bg-rose-600" },
  unrated: { label: "", className: "", dot: "" },
};
