"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  UserRoundCog,
  Search,
  SlidersHorizontal,
  FileEdit,
  MessagesSquare,
  Outdent,
} from "lucide-react";

const STEPS = [
  {
    cmd: "/setup",
    icon: UserRoundCog,
    title: "Profile",
    desc: "Fill in your candidate profile from documents, a CV import, or an interview.",
  },
  {
    cmd: "/scrape",
    icon: Search,
    title: "Search portals",
    desc: "The 6 portal CLIs find matching postings — exactly what the search console above runs.",
  },
  {
    cmd: "/rank",
    icon: SlidersHorizontal,
    title: "Rank fits",
    desc: "Batch-score postings against the fit framework; deal-breakers veto, deadlines flag.",
  },
  {
    cmd: "/apply",
    icon: FileEdit,
    title: "Draft application",
    desc: "Drafter–reviewer pipeline writes a tailored LaTeX CV + cover letter, then critiques and revises.",
  },
  {
    cmd: "/interview",
    icon: MessagesSquare,
    title: "Prep & mock",
    desc: "Stage-specific prep pack, company research, STAR question mapping, mock interview.",
  },
  {
    cmd: "/outcome",
    icon: Outdent,
    title: "Track results",
    desc: "Archive materials, record outcomes, draft follow-ups, calibrate the fit framework.",
  },
];

export function WorkflowPipeline() {
  return (
    <Card className="card-elevated">
      <CardHeader>
        <div>
          <p className="eyebrow flex items-center gap-2">
            <span className="h-px w-6 bg-gradient-to-r from-primary to-transparent" />
            Pipeline
          </p>
          <CardTitle className="mt-1 text-xl font-semibold tracking-tight">The framework&apos;s core workflow</CardTitle>
        </div>
        <CardDescription>
          Twelve Claude Code slash-commands drive this pipeline. The sandbox runs the search stage directly;
          the rest are agent workflows you run with Claude Code inside the cloned repo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.cmd}
                className="card-elevated relative rounded-lg border border-border/70 p-4 hover:border-primary/40"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">{step.cmd}</code>
                  <span className="ml-auto shrink-0 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                    step {i + 1}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
