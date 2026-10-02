"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { X, Plus, RotateCcw, Info } from "lucide-react";
import { useFitProfile, type FitProfile } from "@/lib/job-search/fit-ranker";

interface FitProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ChipList({
  values,
  onRemove,
  inputPlaceholder,
  onAdd,
  accent,
  ariaLabel,
}: {
  values: string[];
  onRemove: (v: string) => void;
  inputPlaceholder: string;
  onAdd: (v: string) => void;
  accent: "emerald" | "rose" | "teal";
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState("");
  const accentClasses = {
    emerald: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
    rose: "border-rose-600/30 bg-rose-600/10 text-rose-700 dark:text-rose-300",
    teal: "border-teal-600/30 bg-teal-600/10 text-teal-700 dark:text-teal-300",
  }[accent];

  function commit() {
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onAdd(v);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <Badge key={v} variant="outline" className={`gap-1 pr-1 text-[11px] ${accentClasses}`}>
            {v}
            <button
              onClick={() => onRemove(v)}
              aria-label={`Remove ${v}`}
              className="rounded-full p-0.5 transition-colors hover:bg-foreground/10"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        {values.length === 0 ? <span className="text-xs text-muted-foreground">Nothing yet.</span> : null}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={inputPlaceholder}
          aria-label={ariaLabel}
          className="h-8 text-xs"
        />
        <Button size="sm" variant="outline" onClick={commit} className="h-8 px-2.5" aria-label={`Add to ${ariaLabel}`}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function FitProfileDialog({ open, onOpenChange }: FitProfileDialogProps) {
  const { profile } = useFitProfile();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <FitProfileDialogContent profile={profile} onDone={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

/**
 * Mounts only while the dialog is open, so the draft state is
 * initialized from the saved profile without a sync-setState effect.
 */
function FitProfileDialogContent({ profile, onDone }: { profile: FitProfile; onDone: () => void }) {
  const { save, reset } = useFitProfile();
  const [draft, setDraft] = useState<FitProfile>(profile);

  function saveAndClose() {
    save(draft);
    onDone();
  }

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto scrollbar-thin sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 tracking-tight">
            Fit profile
            <Badge variant="secondary" className="text-[10px]">triage</Badge>
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Keyword triage for search results — postings are scored against these lists client-side,
            inspired by the repo&apos;s <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">/rank</code> workflow.
            The framework&apos;s full agent scoring (technical / experience / behavioral / career) still lives in{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">/apply</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Must-have skills <span className="font-normal text-muted-foreground">(first three count extra)</span></Label>
            <ChipList
              ariaLabel="Add skill"
              accent="emerald"
              values={draft.skills}
              inputPlaceholder="e.g. python, AWS, stakeholder…"
              onAdd={(v) => setDraft((d) => ({ ...d, skills: [...d.skills, v] }))}
              onRemove={(v) => setDraft((d) => ({ ...d, skills: d.skills.filter((s) => s !== v) }))}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-rose-600 dark:text-rose-400">Deal-breakers <span className="font-normal text-muted-foreground">(vetoes the posting)</span></Label>
            <ChipList
              ariaLabel="Add deal-breaker"
              accent="rose"
              values={draft.dealBreakers}
              inputPlaceholder="e.g. unpaid overtime, relocation…"
              onAdd={(v) => setDraft((d) => ({ ...d, dealBreakers: [...d.dealBreakers, v] }))}
              onRemove={(v) => setDraft((d) => ({ ...d, dealBreakers: d.dealBreakers.filter((s) => s !== v) }))}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Preferred locations <span className="font-normal text-muted-foreground">(+8 pts)</span></Label>
            <ChipList
              ariaLabel="Add preferred location"
              accent="teal"
              values={draft.locations}
              inputPlaceholder="e.g. Copenhagen, Aarhus…"
              onAdd={(v) => setDraft((d) => ({ ...d, locations: [...d.locations, v] }))}
              onRemove={(v) => setDraft((d) => ({ ...d, locations: d.locations.filter((s) => s !== v) }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="remote-friendly" className="text-xs font-semibold">Remote-friendly</Label>
              <p className="text-[11px] text-muted-foreground">+7 pts when a posting mentions remote work</p>
            </div>
            <Switch
              id="remote-friendly"
              checked={draft.remoteFriendly}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, remoteFriendly: v }))}
            />
          </div>

          <p className="flex items-start gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            Scoring runs on posting metadata (title, company, location, extra) returned by the portal CLIs —
            not full descriptions. Scores are heuristics to help you triage, not the framework&apos;s verdict.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => { reset(); setDraft({ ...draft, skills: ["python", "developer", "engineer"], dealBreakers: [], locations: [], remoteFriendly: true }); }} className="mr-auto">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
          </Button>
          <Button variant="outline" size="sm" onClick={onDone}>Cancel</Button>
          <Button size="sm" onClick={saveAndClose} className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-glow transition-transform hover:scale-[1.03] active:scale-95">
            Save profile
          </Button>
        </DialogFooter>
      </DialogContent>
  );
}
