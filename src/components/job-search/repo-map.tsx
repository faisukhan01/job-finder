"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderTree } from "lucide-react";

const PATHS = [
  { path: "CLAUDE.md", desc: "Main candidate profile + workflow rules (populated by /setup)" },
  { path: ".claude/commands/", desc: "12 slash-command workflows: setup, scrape, apply, rank, interview, outcome…" },
  { path: ".claude/skills/", desc: "Methodology: job evaluation, CV/cover templates, writing style, interview prep" },
  { path: ".agents/skills/", desc: "6 portal CLI tools (TypeScript + Bun) — jobindex, jobnet, jobbank, jobdanmark, linkedin, freehire" },
  { path: "cv/", desc: "LaTeX CV template (moderncv, compiles with lualatex)" },
  { path: "cover_letters/", desc: "LaTeX cover letter class (cover.cls, compiles with xelatex)" },
  { path: "salary_lookup.py", desc: "Salary benchmark lookup with fuzzy Danish company-name matching" },
  { path: "tools/", desc: "Framework utilities: security guards, lint, PDF verify, upstream update triage" },
  { path: "tests/", desc: "503 Python unit tests covering the whole toolchain" },
  { path: "documents/", desc: "Your CV, diplomas, references and application archives (gitignored)" },
];

export function RepoMap() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <CardTitle className="text-lg">Repo map</CardTitle>
        </div>
        <CardDescription>
          Cloned at <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">/home/z/my-project/ai-job-search</code>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {PATHS.map((p) => (
            <div key={p.path} className="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5">
              <code className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                {p.path}
              </code>
              <span className="text-xs leading-relaxed text-muted-foreground">{p.desc}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
