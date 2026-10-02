"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileText, Play, CheckCircle2, XCircle, Loader2, Layers } from "lucide-react";

interface CompileOutcome {
  ok: boolean;
  engine: string;
  pages: number | null;
  bytes: number | null;
  seconds: number;
  error: string | null;
}

interface LatexResponse {
  cv: CompileOutcome;
  cover: CompileOutcome;
}

function OutcomeRow({ label, file, outcome }: { label: string; file: string; outcome: CompileOutcome | null }) {
  return (
    <div className="card-elevated flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {outcome ? (
            outcome.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
            )
          ) : (
            <Layers className="h-4 w-4 shrink-0 text-muted-foreground/50" />
          )}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <code className="mt-1 block w-fit max-w-full truncate rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{file}</code>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {outcome ? (
          outcome.ok ? (
            <>
              <Badge variant="secondary" className="text-[10px] tabular-nums">
                {outcome.pages ?? "?"} page{(outcome.pages ?? 0) > 1 ? "s" : ""} · {(outcome.bytes! / 1024).toFixed(0)} KB
              </Badge>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {outcome.engine} · {outcome.seconds.toFixed(1)}s
              </span>
            </>
          ) : (
            <span className="max-w-44 truncate text-[11px] text-rose-500" title={outcome.error ?? ""}>
              {outcome.error}
            </span>
          )
        ) : (
          <span className="text-[10px] text-muted-foreground">not compiled yet</span>
        )}
      </div>
    </div>
  );
}

export function LatexPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LatexResponse | null>(null);

  async function compile() {
    setLoading(true);
    try {
      const res = await fetch("/api/latex", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Compile failed", variant: "destructive" });
        return;
      }
      setResult(data as LatexResponse);
      const ok = (data as LatexResponse).cv.ok && (data as LatexResponse).cover.ok;
      toast({
        title: ok ? "Both documents compiled" : "Compile finished with errors",
        description: ok
          ? `CV (${(data as LatexResponse).cv.pages}p) + cover letter (${(data as LatexResponse).cover.pages}p) in ${(
              (data as LatexResponse).cv.seconds + (data as LatexResponse).cover.seconds
            ).toFixed(1)}s total`
          : (data as LatexResponse).cv.error || (data as LatexResponse).cover.error,
        variant: ok ? "default" : "destructive",
      });
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
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <p className="eyebrow flex items-center gap-2">
              <span className="h-px w-6 bg-gradient-to-r from-primary to-transparent" />
              Toolchain
            </p>
            <CardTitle className="mt-0.5 text-xl font-semibold tracking-tight">LaTeX pipeline</CardTitle>
          </div>
        </div>
        <CardDescription>
          Compiles the stock templates exactly like /apply would — CV via lualatex, cover letter via xelatex (TinyTeX 2026).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <OutcomeRow label="Example CV (moderncv)" file="cv/main_example.tex" outcome={result?.cv ?? null} />
        <OutcomeRow label="Example cover letter" file="cover_letters/cover_example.tex" outcome={result?.cover ?? null} />
        <Button
          onClick={compile}
          disabled={loading}
          size="sm"
          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-glow transition-transform hover:scale-[1.03] active:scale-95 sm:w-auto"
        >
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
          {loading ? "Compiling…" : "Compile both documents"}
        </Button>
      </CardContent>
    </Card>
  );
}
