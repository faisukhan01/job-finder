import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { REPO_ROOT } from "@/lib/job-search/runner";

export const dynamic = "force-dynamic";

/**
 * Serves methodology documents from the repo's .claude/skills folder so the
 * UI can render the framework's own guidance (interview prep, job evaluation).
 * Content is parsed into sections; rendering is plain text on the client —
 * no markdown is interpreted as HTML.
 */

const DOCS: Record<string, { relPath: string; title: string }> = {
  "interview-prep": {
    relPath: ".claude/skills/job-application-assistant/07-interview-prep.md",
    title: "Interview Preparation Guide",
  },
  "job-evaluation": {
    relPath: ".claude/skills/job-application-assistant/04-job-evaluation.md",
    title: "Job Evaluation Framework",
  },
};

export interface GuideSection {
  heading: string;
  body: string[];
}

export interface GuideDoc {
  doc: string;
  title: string;
  intro: string[];
  sections: GuideSection[];
}

function parseGuide(markdown: string): { intro: string[]; sections: GuideSection[] } {
  const lines = markdown.split(/\r?\n/);
  const intro: string[] = [];
  const sections: GuideSection[] = [];
  let current: GuideSection | null = null;

  for (const line of lines) {
    const t = line.trim();
    // Skip frontmatter delimiters, framework version, raw HTML comments and the H1.
    if (t === "---" || /^<!--/.test(t) || /^-->/.test(t)) continue;
    if (t.startsWith("# ") || /^framework_version:/.test(t)) continue;
    if (t.startsWith("## ")) {
      current = { heading: t.slice(3).trim(), body: [] };
      sections.push(current);
      continue;
    }
    if (t.startsWith("### ")) {
      // Keep sub-headings inline as bold-ish text lines.
      const content = t.slice(4).trim();
      if (current) current.body.push(`__${content}__`);
      else intro.push(`__${content}__`);
      continue;
    }
    if (t.startsWith("<!--")) {
      // multi-line comment start — skip until close appears later line-wise (single-line handled above)
      continue;
    }
    if (current) {
      current.body.push(line);
    } else if (t.length > 0) {
      intro.push(line);
    }
  }

  // Drop empty sections and blank lines (client groups list items itself).
  return {
    intro: intro.filter((l) => l.trim().length > 0),
    sections: sections.filter((s) => s.body.some((l) => l.trim().length > 0)).map((s) => ({
      heading: s.heading,
      body: s.body.filter((l) => l.trim().length > 0),
    })),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const docId = searchParams.get("doc") ?? "interview-prep";
  const doc = DOCS[docId];
  if (!doc) {
    return NextResponse.json({ ok: false, error: `Unknown doc: ${docId}` }, { status: 400 });
  }
  const abs = path.join(REPO_ROOT, doc.relPath);
  if (!fs.existsSync(abs)) {
    return NextResponse.json({ ok: false, error: "Guide file not found in the repo" }, { status: 404 });
  }
  try {
    const markdown = fs.readFileSync(abs, "utf8");
    const parsed = parseGuide(markdown);
    const payload: GuideDoc = { doc: docId, title: doc.title, ...parsed };
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to read guide file" }, { status: 500 });
  }
}
