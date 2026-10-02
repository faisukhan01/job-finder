"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useShortlist } from "@/lib/job-search/shortlist";
import { translateDanish } from "@/lib/job-search/danish-labels";
import type { DetailResponse, NormalizedJob } from "@/lib/job-search/shared-types";
import {
  Building2,
  MapPin,
  CalendarDays,
  Copy,
  Star,
  AlertTriangle,
  FileText,
  Clock3,
  Briefcase,
  Send,
  Sparkles,
} from "lucide-react";

interface JobDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalId: string;
  portalName: string;
  job: NormalizedJob | null;
}

/**
 * Body of the sheet, remounted per (portal, job) so each posting's
 * fetch state starts fresh without synchronous effect setState.
 */
function DetailBody({ portalId, portalName, job }: { portalId: string; portalName: string; job: NormalizedJob }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DetailResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portal: portalId, id: job.id }),
    })
      .then((r) => r.json())
      .then((d: DetailResponse) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) {
          setData({
            portal: portalId, id: job.id, ok: false, detail: null,
            error: "Network error while fetching the job detail.", errorCode: "NETWORK",
            tookMs: 0, cached: false,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [portalId, job.id]);

  const detail = data?.detail ?? null;
  const starred = useShortlistStarState(portalId, job);

  function copyDescription() {
    const text = detail?.description;
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => toast({ title: "Description copied", description: `${text.length.toLocaleString()} characters on the clipboard.` }),
      () => toast({ title: "Copy failed", variant: "destructive" }),
    );
  }

  const metaChips: { icon: React.ReactNode; label: string; title?: string }[] = [];
  if (detail?.employmentType) {
    const t = translateDanish(detail.employmentType);
    metaChips.push({
      icon: <Briefcase className="h-3 w-3" />,
      label: t.text,
      title: t.translated ? `DK: ${detail.employmentType}` : undefined,
    });
  }
  if (detail?.hours) {
    const t = translateDanish(detail.hours);
    metaChips.push({
      icon: <Clock3 className="h-3 w-3" />,
      label: t.text,
      title: t.translated ? `DK: ${detail.hours}` : undefined,
    });
  }
  if (detail?.date) metaChips.push({ icon: <CalendarDays className="h-3 w-3" />, label: `posted ${detail.date}` });
  if (detail?.deadline) metaChips.push({ icon: <CalendarDays className="h-3 w-3" />, label: `deadline ${detail.deadline}` });

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin" aria-live="polite">
        {loading ? (
          <div className="space-y-3" aria-label="Loading job detail">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-10/12" />
            <Skeleton className="mt-6 h-4 w-full" />
            <Skeleton className="h-4 w-9/12" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-8/12" />
          </div>
        ) : !data?.ok ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Could not load the full posting</AlertTitle>
            <AlertDescription className="text-xs">
              {data?.error ?? "Unknown error"}
              {data?.errorCode === "API_ERROR" ? (
                <span className="mt-1 block opacity-80">
                  The portal may be rate-limiting or bot-blocking this sandbox IP. Try again shortly or open the original posting.
                </span>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {metaChips.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {metaChips.map((chip, i) => (
                  <span
                    key={i}
                    title={chip.title}
                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {chip.icon} {chip.label}
                  </span>
                ))}
              </div>
            ) : null}

            {detail?.description ? (
              <article className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <span className="h-1 w-5 rounded-full bg-emerald-500" />
                  Job description
                </h3>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {detail.description}
                </div>
              </article>
            ) : (
              <div className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-center text-xs text-muted-foreground">
                {detail?.notes[0] ?? "No description available for this posting."}
              </div>
            )}
          </div>
        )}
      </div>

      <Separator className="opacity-60" />
      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 bg-muted/30 px-5 py-3">
        <Button
          size="sm"
          variant={starred ? "secondary" : "outline"}
          onClick={() => starred.toggle(portalId, portalName, job)}
          aria-pressed={starred.on}
          className="min-h-9"
        >
          <Star className={`mr-1.5 h-3.5 w-3.5 ${starred.on ? "fill-amber-400 text-amber-500" : ""}`} />
          {starred.on ? "Starred" : "Star"}
        </Button>
        {detail?.applyUrl || job.url ? (
          <Button size="sm" asChild className="min-h-9 bg-emerald-600 text-white hover:bg-emerald-700">
            <a href={detail?.applyUrl ?? job.url ?? "#"} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> Open posting
            </a>
          </Button>
        ) : null}
        {detail?.description ? (
          <Button size="sm" variant="outline" onClick={copyDescription} className="min-h-9">
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy text
          </Button>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <FileText className="h-3 w-3" />
          {data?.ok && detail?.description
            ? `${detail.description.length.toLocaleString()} chars · ${(data.tookMs / 1000).toFixed(1)}s${data.cached ? " · cached" : ""}`
            : `via ${portalName} CLI`}
        </span>
      </div>
    </>
  );
}

/** Small helper hook so DetailBody stays readable. */
function useShortlistStarState(portalId: string, job: NormalizedJob) {
  const { isStarred, toggle, hydrated } = useShortlist();
  return {
    on: hydrated && isStarred(portalId, job.id),
    toggle,
  };
}

export function JobDetailSheet({ open, onOpenChange, portalId, portalName, job }: JobDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl" side="right">
        {job ? (
          <>
            <SheetHeader className="space-y-1 border-b border-border/70 bg-muted/30 px-5 py-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{portalName}</Badge>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Sparkles className="h-3 w-3" /> fetched live via CLI
                </span>
              </div>
              <SheetTitle className="text-base leading-snug">{job.title}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {job.company ? (
                  <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {job.company}</span>
                ) : null}
                {job.location ? (
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location}</span>
                ) : null}
                {job.id ? <span className="font-mono text-[10px] opacity-60">id: {job.id}</span> : null}
              </SheetDescription>
            </SheetHeader>
            <DetailBody key={`${portalId}-${job.id}`} portalId={portalId} portalName={portalName} job={job} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">No posting selected.</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
