"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ShortcutEntry {
  keys: string[];
  label: string;
}

export const SHORTCUTS: ShortcutEntry[] = [
  { keys: ["⌘", "K"], label: "Open the command palette (actions, panels, jobs)" },
  { keys: ["/"], label: "Focus the keyword search field" },
  { keys: ["Enter"], label: "Run the search (from a search field)" },
  { keys: ["S"], label: "Open the shortlist dialog" },
  { keys: ["F"], label: "Open the fit profile editor" },
  { keys: ["D"], label: "Toggle light / dark theme" },
  { keys: ["?"], label: "Show this shortcut help" },
  { keys: ["Esc"], label: "Close dialogs and dropdowns" },
];

/** Keyboard shortcut cheat-sheet dialog. */
export function ShortcutHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10" />
              </svg>
            </span>
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Single-key shortcuts work whenever you are not typing in a field.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1" aria-label="Keyboard shortcuts">
          {SHORTCUTS.map((s) => (
            <li
              key={s.label}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
            >
              <span className="text-foreground/90">{s.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="min-w-6 rounded border border-border bg-muted px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold text-foreground shadow-sm"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
