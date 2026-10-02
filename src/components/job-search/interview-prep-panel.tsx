"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Quote, ListChecks, FileText, AlertTriangle, RefreshCw, Download } from "lucide-react";

interface GuideSection {
  heading: string;
  body: string[];
}

interface GuideDoc {
  doc: string;
  title: string;
  intro: string[];
  sections: GuideSection[];
}

const LS_KEY = "aijs.interviewprep.v1";

/** Minimal safe markdown-ish renderer: bold, bullets, numbered items, quotes. No HTML. */
function GuideBody({ lines }: { lines: string[] }) {
  const blocks = useMemo(() => {
    const out: React.ReactNode[] = [];
    let bullets: string[] = [];
    let numbers: string[] = [];

    const flushBullets = () => {
      if (bullets.length === 0) return;
      out.push(
        <ul key={`ul-${out.length}`} className="ml-1 list-outside list-disc space-y-1 pl-4">
          {bullets.map((b, i) => (
            <li key={i} className="text-sm leading-relaxed">{inline(b)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    };
    const flushNumbers = () => {
      if (numbers.length === 0) return;
      out.push(
        <ol key={`ol-${out.length}`} className="ml-1 list-outside list-decimal space-y-1 pl-4">
          {numbers.map((b, i) => (
            <li key={i} className="text-sm leading-relaxed">{inline(b)}</li>
          ))}
        </ol>,
      );
      numbers = [];
    };

    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith("- ")) {
        flushNumbers();
        bullets.push(line.slice(2));
        continue;
      }
      const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        flushBullets();
        numbers.push(numMatch[2]);
        continue;
      }
      if (line.startsWith("> ")) {
        flushBullets();
        flushNumbers();
        out.push(
          <div key={`q-${out.length}`} className="flex items-start gap-2 rounded-md border-l-2 border-primary/40 bg-primary/[0.05] px-3 py-2">
            <Quote className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
            <span className="text-sm italic leading-relaxed">{inline(line.slice(2))}</span>
          </div>,
        );
        continue;
      }
      flushBullets();
      flushNumbers();
      if (line.startsWith("__") && line.endsWith("__")) {
        out.push(
          <p key={`h-${out.length}`} className="pt-1 text-[13px] font-semibold text-foreground">
            {inline(line.slice(2, -2))}
          </p>,
        );
        continue;
      }
      out.push(
        <p key={`p-${out.length}`} className="text-sm leading-relaxed">
          {inline(line)}
        </p>,
      );
    }
    flushBullets();
    flushNumbers();
    return out;
  }, [lines]);

  return <div className="space-y-2">{blocks}</div>;
}

/** Renders **bold** spans as plain <strong> text nodes (no dangerouslySetInnerHTML). */
function inline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
      return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}

export function InterviewPrepPanel() {
  const { toast } = useToast();
  const [guide, setGuide] = useState<GuideDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/guide?doc=interview-prep");
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load the guide");
      } else {
        setGuide(data as GuideDoc);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw) setDone(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* fresh start */
    }
    setHydrated(true);
  }, [load]);

  function toggleDone(heading: string, checked: boolean) {
    setDone((prev) => {
      const next = { ...prev, [heading]: checked };
      if (!checked) delete next[heading];
      try {
        window.localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }

  const total = guide?.sections.length ?? 0;
  const doneCount = guide ? guide.sections.filter((s) => done[s.heading]).length : 0;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  /** Export the checklist (with rehearsed state) as a portable markdown file. */
  function exportChecklist() {
    if (!guide) return;
    const lines: string[] = [
      "# Interview prep checklist",
      "",
      `_Generated from the ai-job-search framework · ${new Date().toLocaleDateString()} · ${doneCount}/${total} sections rehearsed_`,
      "",
    ];
    if (guide.intro.length > 0) {
      lines.push(...guide.intro, "");
    }
    for (const s of guide.sections) {
      lines.push(`## ${done[s.heading] ? "✅ " : ""}${s.heading}`, "");
      for (const body of s.body) {
        if (body.trim().startsWith("- ")) {
          lines.push(`- [ ] ${body.trim().slice(2)}`);
        } else if (body.trim()) {
          lines.push(body.trim());
        }
      }
      lines.push("");
    }
    lines.push("---", "", "_Source: ai-job-search/.claude/skills/job-application-assistant/07-interview-prep.md_");
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "interview-prep-checklist.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({ title: "Checklist exported", description: `interview-prep-checklist.md · ${doneCount}/${total} rehearsed` });
  }

  return (
    <Card className="card-elevated overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <p className="eyebrow flex items-center gap-2">
                <span className="h-px w-6 bg-gradient-to-r from-primary to-transparent" />
                Interview prep
              </p>
              <CardTitle className="mt-0.5 text-xl font-semibold tracking-tight">Interview prep</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-muted-foreground">
              from the repo
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={exportChecklist}
              disabled={loading || !guide}
              className="h-7 text-xs text-muted-foreground"
              aria-label="Export checklist as markdown"
            >
              <Download className="mr-1 h-3 w-3" /> Export
            </Button>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="h-7 text-xs text-muted-foreground">
              <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Reload
            </Button>
          </div>
        </div>
        <CardDescription>
          The framework&apos;s own <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">/interview</code> methodology
          (STAR answers, tough questions, questions to ask) served straight from{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">07-interview-prep.md</code>. Tick sections off as you rehearse.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !guide ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
            <button onClick={load} className="shrink-0 text-xs font-medium underline underline-offset-2">
              Retry
            </button>
          </div>
        ) : guide ? (
          <>
            {/* progress */}
            <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
              <ListChecks className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">Rehearsal progress</span>
                  <span className="tabular-nums text-muted-foreground">
                    {doneCount}/{total} sections
                  </span>
                </div>
                <Progress value={hydrated ? pct : 0} className="h-1.5" aria-label={`${pct}% of sections rehearsed`} />
              </div>
            </div>

            {guide.intro.length > 0 ? (
              <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-2.5">
                <GuideBody lines={guide.intro} />
              </div>
            ) : null}

            <Accordion type="multiple" defaultValue={[guide.sections[0]?.heading].filter(Boolean)}>
              {guide.sections.map((s, idx) => (
                <AccordionItem key={s.heading} value={s.heading}>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`prep-${idx}`}
                      checked={hydrated ? Boolean(done[s.heading]) : false}
                      onCheckedChange={(c) => toggleDone(s.heading, c === true)}
                      aria-label={`Mark section ${s.heading} as rehearsed`}
                      className="shrink-0"
                    />
                    <AccordionTrigger className="flex-1 py-3 text-left hover:no-underline">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {done[s.heading] ? (
                          <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        ) : null}
                        <span className={done[s.heading] ? "text-muted-foreground line-through decoration-emerald-500/50" : ""}>
                          {s.heading}
                        </span>
                      </span>
                    </AccordionTrigger>
                  </div>
                  <AccordionContent className="px-1 pb-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                      <GuideBody lines={s.body} />
                    </motion.div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
