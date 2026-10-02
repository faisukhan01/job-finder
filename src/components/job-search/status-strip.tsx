"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GitBranch,
  Terminal,
  Braces,
  Globe,
  FileText,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Coins,
} from "lucide-react";
import type { EnvStatus } from "@/lib/job-search/shared-types";

interface StatusStripProps {
  status: EnvStatus | null;
  loading: boolean;
}

function StatusCard({
  icon,
  label,
  value,
  sub,
  state,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  state: "ok" | "warn" | "error";
}) {
  const stateColor =
    state === "ok" ? "text-emerald-600 dark:text-emerald-400" : state === "warn" ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
  return (
    <Card className="border-border/70">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <span className={stateColor}>{icon}</span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        </div>
        <div className="mt-2 text-sm font-semibold leading-snug">{value}</div>
        {sub ? <div className="mt-1 text-xs text-muted-foreground leading-snug">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

export function StatusStrip({ status, loading }: StatusStripProps) {
  if (loading || !status) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-border/70">
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const installed = status.portals.filter((p) => p.installed).length;
  const latexOk = !!status.toolchain.lualatex && !!status.toolchain.xelatex;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatusCard
        icon={<GitBranch className="h-4 w-4" />}
        label="Repository"
        state={status.repo.cloned ? "ok" : "error"}
        value={
          status.repo.cloned ? (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Cloned
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4" /> Missing
            </span>
          )
        }
        sub={
          status.repo.branch ? (
            <span className="font-mono">
              {status.repo.branch} · {status.repo.headCommit?.split("—")[0]?.trim()}
            </span>
          ) : null
        }
      />
      <StatusCard
        icon={<Terminal className="h-4 w-4" />}
        label="Bun runtime"
        state={status.runtimes.bun ? "ok" : "error"}
        value={status.runtimes.bun ? `v${status.runtimes.bun}` : "not found"}
        sub="Runs the 6 portal CLIs"
      />
      <StatusCard
        icon={<Braces className="h-4 w-4" />}
        label="Python"
        state={status.runtimes.python ? "ok" : "error"}
        value={status.runtimes.python || "not found"}
        sub="Salary tool + 503 tests"
      />
      <StatusCard
        icon={<Globe className="h-4 w-4" />}
        label="Portal CLIs"
        state={installed === status.portals.length ? "ok" : installed > 0 ? "warn" : "error"}
        value={
          <span className="flex items-center gap-1.5">
            {installed === status.portals.length ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {installed}/{status.portals.length} installed
          </span>
        }
        sub="bun install per CLI"
      />
      <StatusCard
        icon={<FileText className="h-4 w-4" />}
        label="LaTeX"
        state={latexOk ? "ok" : "warn"}
        value={latexOk ? "lualatex + xelatex" : "installing…"}
        sub={latexOk ? "CV & cover letter compile ready" : "TinyTeX installing in background"}
      />
      <StatusCard
        icon={<ShieldCheck className="h-4 w-4" />}
        label="Extras"
        state={status.toolchain.pypdf && status.toolchain.pdftotext ? "ok" : "warn"}
        value={
          <span className="flex flex-wrap gap-1">
            <Badge variant={status.toolchain.pypdf ? "default" : "outline"} className="text-[10px] px-1.5">
              pypdf
            </Badge>
            <Badge variant={status.toolchain.pdftotext ? "default" : "outline"} className="text-[10px] px-1.5">
              pdftotext
            </Badge>
            <Badge variant={status.toolchain.salaryData ? "default" : "outline"} className="text-[10px] px-1.5">
              <Coins className="mr-0.5 h-2.5 w-2.5" />
              salary
            </Badge>
          </span>
        }
        sub="ATS parse + salary demo"
      />
    </div>
  );
}
