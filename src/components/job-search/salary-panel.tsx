"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useShortlist } from "@/lib/job-search/shortlist";
import {
  Coins,
  Loader2,
  Search,
  MapPin,
  Info,
  TrendingUp,
  Users,
  Star,
} from "lucide-react";

interface SalaryCategory {
  count?: number;
  index?: number;
}

interface SalaryEntry {
  company: string;
  city?: string | null;
  categories?: Record<string, SalaryCategory> | null;
}

interface SalaryMeta {
  source?: string;
  index_label?: string;
  baseline_description?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  all_employees: "All employees",
  engineering: "Engineering",
  it_specialists: "IT specialists",
  management: "Management",
};

function categoryLabel(key: string): string {
  return (
    CATEGORY_LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function indexTone(index: number): string {
  if (index >= 115) return "text-emerald-600 dark:text-emerald-400";
  if (index >= 105) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

export function SalaryPanel({ hintCompanies }: { hintCompanies: string[] }) {
  const { toast } = useToast();
  const { items, hydrated: shortlistHydrated } = useShortlist();
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<SalaryEntry[] | null>(null);
  const [meta, setMeta] = useState<SalaryMeta | null>(null);
  const [available, setAvailable] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Employers on the shortlist, distinct, most recent first. */
  const shortlistCompanies = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const it of items) {
      const c = it.job.company?.trim();
      if (!c) continue;
      const key = c.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out.slice(0, 6);
  }, [items]);

  useEffect(() => {
    fetch("/api/salary")
      .then((r) => r.json())
      .then((d) => {
        setAvailable(d.available === true);
        if (d.metadata) setMeta(d.metadata as SalaryMeta);
      })
      .catch(() => setAvailable(false));
  }, []);

  // The command palette can pre-fill + run a lookup for a demo-data company.
  // Listener stays subscribed for the panel's lifetime; the ref pattern keeps
  // the handler pointed at the latest `lookup` without re-subscribing.
  const lookupRef = useRef(lookup);
  useEffect(() => {
    lookupRef.current = lookup;
  });
  useEffect(() => {
    function onCompany(e: Event) {
      const detail = (e as CustomEvent<{ company?: string }>).detail;
      const target = detail?.company?.trim();
      if (!target) return;
      setCompany(target);
      lookupRef.current(target);
    }
    window.addEventListener("aijs:salary-company", onCompany);
    return () => window.removeEventListener("aijs:salary-company", onCompany);
  }, []);

  async function lookup(name?: string) {
    const target = (name ?? company).trim();
    if (!target) {
      toast({ title: "Enter a company name", description: "Fuzzy matching handles misspellings and legal suffixes (A/S, ApS)." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Lookup failed", variant: "destructive" });
        return;
      }
      setMatches(data.matches as SalaryEntry[]);
      if ((data.matches as SalaryEntry[]).length === 0) {
        toast({ title: `No salary data matches "${target}"`, description: "Try a shorter fragment of the name." });
      }
    } catch (e) {
      toast({ title: "Network error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="card-elevated">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Coins className="h-5 w-5" />
          </span>
          <div>
            <p className="eyebrow flex items-center gap-2">
              <span className="h-px w-6 bg-gradient-to-r from-primary to-transparent" />
              Compensation
            </p>
            <CardTitle className="mt-0.5 text-xl font-semibold tracking-tight">Salary benchmark</CardTitle>
          </div>
        </div>
        <CardDescription>
          Drives the repo&apos;s <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">salary_lookup.py</code>{" "}
          — fuzzy-matches Danish company names, then breaks pay down per category.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!available ? (
          <div className="flex items-start gap-2 rounded-lg border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            salary_data.json is not present — this is the framework&apos;s documented optional step. /apply simply skips it.
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder='e.g. "Novo", "Maersk", "Trackunit"…'
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) lookup();
                }}
                aria-label="Company name"
              />
              <Button
                onClick={() => lookup()}
                disabled={loading}
                className="shrink-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-glow transition-transform hover:scale-[1.03] active:scale-95"
              >
                {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}
                Look up
              </Button>
            </div>

            {shortlistHydrated && shortlistCompanies.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Star className="h-3 w-3 text-amber-500" /> From your shortlist:
                </span>
                {shortlistCompanies.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setCompany(c);
                      lookup(c);
                    }}
                    title={`Look up salary data for ${c}`}
                    className="rounded-full border border-amber-500/40 bg-amber-500/[0.06] px-2 py-0.5 text-[11px] font-medium text-amber-700 transition-all hover:bg-amber-500/15 active:scale-95 dark:text-amber-400"
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : null}

            {hintCompanies.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">Try:</span>
                {hintCompanies.slice(0, 5).map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setCompany(c);
                      lookup(c);
                    }}
                    className="rounded-full border border-border/70 bg-card px-2 py-0.5 text-[11px] text-muted-foreground transition-all hover:border-primary/40 hover:bg-accent hover:text-foreground active:scale-95"
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : null}

            {matches && matches.length > 0 ? (
              <div className="space-y-3">
                {matches.map((m) => {
                  const cats = Object.entries(m.categories ?? {});
                  const all = cats.find(([k]) => k === "all_employees")?.[1];
                  return (
                    <div key={m.company} className="rounded-xl border border-border/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{m.company}</span>
                        {m.city ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {m.city}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {cats.map(([key, cat]) =>
                          typeof cat.index === "number" ? (
                            <div key={key} className="rounded-md bg-muted/50 px-2.5 py-2">
                              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                                {key !== "all_employees" ? <Users className="h-2.5 w-2.5" /> : null}
                                {categoryLabel(key)}
                              </div>
                              <div className={`mt-0.5 flex items-baseline gap-1 text-lg font-bold tabular-nums ${indexTone(cat.index)}`}>
                                {cat.index.toFixed(1)}
                                {all?.index ? (
                                  <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                                    {cat.index - all.index >= 0 ? "+" : ""}
                                    {(cat.index - all.index).toFixed(1)}
                                  </span>
                                ) : null}
                              </div>
                              {cat.count ? (
                                <div className="text-[10px] tabular-nums text-muted-foreground">n={cat.count.toLocaleString()}</div>
                              ) : null}
                            </div>
                          ) : null,
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                  <TrendingUp className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>
                    {meta?.baseline_description ?? "Index 100 = median salary for the category."} Delta shown against
                    &quot;All employees&quot;.
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Info className="h-3 w-3" />
                  <span className="line-clamp-1">{meta?.source ?? "Demo data"}</span>
                  <Badge variant="outline" className="ml-auto shrink-0 text-[9px]">
                    demo data
                  </Badge>
                </div>
              </div>
            ) : matches && matches.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                No match — try a shorter fragment (e.g. &quot;Novo&quot; instead of a full legal name).
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
