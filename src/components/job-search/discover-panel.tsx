"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Compass, Loader2, Sparkles, Tag, BookOpen, ArrowRight, RefreshCw, AlertTriangle, Languages } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { translateDanish } from "@/lib/job-search/danish-labels";

interface DiscoverCategory {
  id: string;
  title: string;
  helpText: string | null;
  count: number;
}

interface DiscoverOccupation {
  label: string;
  aliases: string[];
}

/** Fired when the user picks a category/occupation so SearchConsole can run it. */
export function requestSearch(detail: SearchRequestDetail) {
  window.dispatchEvent(new CustomEvent<SearchRequestDetail>("aijs:search-request", { detail }));
}

export interface SearchRequestDetail {
  portal: string;
  query?: string;
  /** Optional location (LinkedIn + some portals). Set when replaying a recent search. */
  location?: string;
  jobdanmarkCategory?: { id: string; title: string };
  ts: number;
}

function CategoryRow({
  cat,
  max,
  index,
  active,
  onSelect,
}: {
  cat: DiscoverCategory;
  max: number;
  index: number;
  active: boolean;
  onSelect: (cat: DiscoverCategory) => void;
}) {
  const pct = max > 0 ? Math.max(4, Math.round((cat.count / max) * 100)) : 4;
  const title = translateDanish(cat.title);
  const help = cat.helpText ? translateDanish(cat.helpText) : null;
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
      onClick={() => onSelect(cat)}
      className={`group relative block w-full overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-all hover:border-emerald-500/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? "border-emerald-500/60 bg-emerald-500/[0.06]" : "border-border/70 bg-card/50"
      }`}
      aria-label={`Search jobdanmark category ${title.text}, ${cat.count} live postings`}
    >
      {/* count bar */}
      <span
        aria-hidden
        style={{ width: `${pct}%` }}
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent transition-all duration-300 group-hover:from-emerald-500/25"
      />
      <span className="relative flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span
            className="block truncate text-sm font-medium group-hover:underline group-hover:underline-offset-2"
            title={title.translated ? `DK: ${cat.title}` : undefined}
          >
            {title.text}
          </span>
          {help ? (
            <span
              className="mt-0.5 block truncate text-[11px] text-muted-foreground"
              title={help.translated ? `DK: ${cat.helpText}` : undefined}
            >
              {help.text}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <Badge variant="secondary" className="tabular-nums">
            {cat.count.toLocaleString()}
          </Badge>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
        </span>
      </span>
    </motion.button>
  );
}

export function DiscoverPanel() {
  const { toast } = useToast();
  const [tab, setTab] = useState("categories");
  const [categories, setCategories] = useState<DiscoverCategory[] | null>(null);
  const [catsLoading, setCatsLoading] = useState(true);
  const [catsError, setCatsError] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const [occQuery, setOccQuery] = useState("");
  const [occupations, setOccupations] = useState<DiscoverOccupation[] | null>(null);
  const [occLoading, setOccLoading] = useState(false);
  const [occError, setOccError] = useState<string | null>(null);
  const occSeq = useRef(0);

  const loadCategories = useCallback(
    async (force = false) => {
      setCatsLoading(true);
      setCatsError(null);
      try {
        const res = await fetch(`/api/discover?source=categories${force ? "&force=1" : ""}`);
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setCatsError(typeof data.error === "string" ? data.error : "Failed to load categories");
          setCategories(null);
        } else {
          setCategories(data.categories as DiscoverCategory[]);
        }
      } catch {
        setCatsError("Network error while loading categories");
        setCategories(null);
      } finally {
        setCatsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadCategories(false);
  }, [loadCategories]);

  const searchOccupations = useCallback(async () => {
    const q = occQuery.trim();
    if (!q) {
      toast({ title: "Type a Danish occupation to browse, e.g. udvikler", variant: "destructive" });
      return;
    }
    const seq = ++occSeq.current;
    setOccLoading(true);
    setOccError(null);
    try {
      const res = await fetch(`/api/discover?source=occupations&query=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (seq !== occSeq.current) return; // stale response
      if (!res.ok || !data.ok) {
        setOccError(typeof data.error === "string" ? data.error : "Lookup failed");
        setOccupations(null);
      } else {
        setOccupations(data.occupations as DiscoverOccupation[]);
      }
    } catch {
      if (seq === occSeq.current) setOccError("Network error");
    } finally {
      if (seq === occSeq.current) setOccLoading(false);
    }
  }, [occQuery, toast]);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600/10 text-amber-600 dark:text-amber-400">
              <Compass className="h-4 w-4" />
            </span>
            <CardTitle className="text-lg">Discover</CardTitle>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-muted-foreground">
              live taxonomies
            </Badge>
          </div>
          {tab === "categories" ? (
            <Button variant="ghost" size="sm" onClick={() => loadCategories(true)} disabled={catsLoading} className="h-7 text-xs text-muted-foreground">
              <RefreshCw className={`mr-1 h-3 w-3 ${catsLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          ) : null}
        </div>
        <CardDescription>
          Browse the portals&apos; own vocabularies — jobdanmark&apos;s live category counts and jobnet&apos;s official
          occupation index, translated from Danish where we can (hover for the original). Click anything to run that search below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 h-9">
            <TabsTrigger value="categories" className="gap-1.5 text-xs">
              <Tag className="h-3 w-3" /> Categories
            </TabsTrigger>
            <TabsTrigger value="occupations" className="gap-1.5 text-xs">
              <BookOpen className="h-3 w-3" /> Occupations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="mt-0">
            {catsLoading && !categories ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : catsError ? (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">{catsError}</span>
                <Button variant="outline" size="sm" className="h-7 shrink-0" onClick={() => loadCategories(true)}>
                  Retry
                </Button>
              </div>
            ) : categories ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {categories.map((c, i) => (
                  <CategoryRow
                    key={c.id}
                    cat={c}
                    max={categories[0]?.count ?? 1}
                    index={i}
                    active={activeCategoryId === c.id}
                    onSelect={(cat) => {
                      setActiveCategoryId(cat.id);
                      requestSearch({ portal: "jobdanmark", jobdanmarkCategory: { id: cat.id, title: cat.title }, ts: Date.now() });
                    }}
                  />
                ))}
              </div>
            ) : null}
            <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Counts are live from jobdanmark.dk — click a category to fill the search console with that filter.
            </p>
          </TabsContent>

          <TabsContent value="occupations" className="mt-0">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                searchOccupations();
              }}
            >
              <Input
                value={occQuery}
                onChange={(e) => setOccQuery(e.target.value)}
                placeholder="Danish occupation, e.g. udvikler, sygeplejerske, murer…"
                aria-label="Occupation search"
              />
              <Button type="submit" disabled={occLoading} className="shrink-0 bg-amber-600 text-white hover:bg-amber-700">
                {occLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                <span className="ml-1.5 hidden sm:inline">Find</span>
              </Button>
            </form>

            {occLoading ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-36 rounded-full" />
                ))}
              </div>
            ) : occError ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {occError}
              </div>
            ) : occupations ? (
              occupations.length > 0 ? (
                <TooltipProvider delayDuration={150}>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {occupations.map((o) => {
                      const tr = translateDanish(o.label);
                      return (
                        <Tooltip key={o.label}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => requestSearch({ portal: "jobnet", query: o.label, ts: Date.now() })}
                              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-card/60 px-2.5 py-1 text-xs transition-all hover:border-emerald-500/50 hover:bg-emerald-500/[0.06]"
                              title={tr.translated ? `DK: ${o.label}` : undefined}
                            >
                              {tr.translated ? (
                                <Languages className="h-3 w-3 shrink-0 text-muted-foreground/60" aria-label="translated from Danish" />
                              ) : null}
                              <span className="truncate font-medium">{tr.text}</span>
                              {o.aliases.length > 0 ? <span className="shrink-0 text-[10px] text-muted-foreground">+{o.aliases.length}</span> : null}
                            </button>
                          </TooltipTrigger>
                          {o.aliases.length > 0 ? (
                            <TooltipContent side="top" className="max-w-72 text-xs">
                              <span className="font-semibold">Also matches:</span> {o.aliases.join(" · ")}
                            </TooltipContent>
                          ) : null}
                        </Tooltip>
                      );
                    })}
                  </div>
                </TooltipProvider>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No official occupation matched that term — try a broader Danish word.</p>
              )
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Searches the Danish national ESCO occupation index (Starthjælpenevnet data) via the jobnet CLI.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
