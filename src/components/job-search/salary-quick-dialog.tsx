"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Banknote, Loader2, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SalaryCategory {
  count?: number;
  index?: number;
}

interface SalaryMatch {
  company: string;
  city?: string | null;
  categories?: Record<string, SalaryCategory> | null;
}

interface SalaryQuickResponse {
  query: string;
  matches: SalaryMatch[];
  metadata?: Record<string, unknown> | null;
  error?: string;
}

function fmtIndex(n: number): string {
  return n.toLocaleString("da-DK", { maximumFractionDigits: 0 });
}

/** "it_specialists" → "IT specialists", "all_employees" → "All employees". */
function prettyCategory(key: string): string {
  const s = key.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Fetches on mount; mounted fresh (keyed by company) each time the dialog
 * opens so no synchronous setState-in-effect is needed.
 */
function SalaryBody({ company }: { company: string }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<SalaryQuickResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/salary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company }),
    })
      .then(async (res) => {
        const data = (await res.json()) as SalaryQuickResponse;
        if (cancelled) return;
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : `Lookup failed (${res.status})`);
        } else {
          setResult(data);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Network error while contacting salary_lookup.py.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Looking up &quot;{company}&quot;…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/[0.06] px-3 py-3 text-sm text-amber-700 dark:text-amber-400">
        {error}
        <p className="mt-1 text-xs opacity-80">
          The demo salary dataset only covers a handful of Danish employers — use the Salary panel to see which.
        </p>
      </div>
    );
  }

  const match = result?.matches?.[0] ?? null;
  const catEntries = Object.entries(match?.categories ?? {});

  if (!match) {
    return <p className="py-4 text-sm text-muted-foreground">No match found for &quot;{company}&quot; in the dataset.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{match.company}</div>
          {match.city ? <div className="text-xs text-muted-foreground">{match.city}</div> : null}
        </div>
        {result?.metadata && typeof result.metadata === "object" && "source" in result.metadata ? (
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
            {String(result.metadata.source).slice(0, 40)}
          </span>
        ) : null}
      </div>
      {catEntries.length > 0 ? (
        <div className="grid grid-cols-1 gap-2">
          {catEntries.map(([name, c]) =>
            typeof c.index === "number" ? (
              <div key={name} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm">{prettyCategory(name)}</span>
                <span className="ml-3 flex shrink-0 items-center gap-1.5 text-sm font-semibold tabular-nums">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  {fmtIndex(c.index)}
                  {c.count != null ? <span className="text-[10px] font-normal text-muted-foreground">({c.count})</span> : null}
                </span>
              </div>
            ) : null,
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Matched the employer, but the dataset has no category indexes for it.</p>
      )}
    </div>
  );
}

function SalaryQuickDialog({ company, open, onOpenChange }: { company: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Salary benchmark{company ? ` — ${company}` : ""}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Fuzzy-matched through the repo&apos;s <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">salary_lookup.py</code>.
            Index values are relative (100 = all Danish employees).
          </DialogDescription>
        </DialogHeader>
        {open ? <SalaryBody key={company} company={company} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/** Row-level trigger: stopPropagation keeps the row's detail sheet closed. */
export function SalaryQuickTrigger({ company, disabled }: { company: string; disabled?: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const safeCompany = company.trim();
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (!safeCompany) {
                toast({ title: "No company name on this posting to benchmark", variant: "destructive" });
                return;
              }
              setOpen(true);
            }}
            aria-label={safeCompany ? `Salary benchmark for ${safeCompany}` : "Salary benchmark (no company)"}
            className="rounded-full p-1 text-muted-foreground/30 transition-all hover:bg-emerald-500/10 hover:text-emerald-600 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none dark:hover:text-emerald-400 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <Banknote className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Salary benchmark{safeCompany ? `: ${safeCompany}` : ""}
        </TooltipContent>
      </Tooltip>
      <SalaryQuickDialog company={safeCompany} open={open} onOpenChange={setOpen} />
    </TooltipProvider>
  );
}
