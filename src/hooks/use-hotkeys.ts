"use client";

import { useEffect, useRef } from "react";

export interface HotkeyDef {
  /** Single-character key (lowercase) or named key, e.g. "s", "/", "?" */
  key: string;
  /** Optional modifier that must be held (shift implied by "?" style keys is NOT auto-detected) */
  meta?: boolean;
  handler: () => void;
  /** Human description for the help palette. */
  label: string;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

/**
 * Global hotkeys. Plain single-key defs fire when no text field is focused and
 * no modifier is held; defs with `meta: true` fire on Cmd/Ctrl+key anywhere
 * (even while typing — standard palette behavior, e.g. ⌘K).
 */
export function useHotkeys(defs: HotkeyDef[]): void {
  // Keep the latest handlers without re-binding the listener on every render.
  const defsRef = useRef<HotkeyDef[]>(defs);
  useEffect(() => {
    defsRef.current = defs;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const defs2 = defsRef.current;
      const key = e.key;
      // Modifier combos (⌘K / Ctrl+K) take priority and work while typing.
      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        for (const def of defs2) {
          if (!def.meta) continue;
          if (key === def.key || key.toLowerCase() === def.key.toLowerCase()) {
            e.preventDefault();
            def.handler();
            return;
          }
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      for (const def of defs2) {
        if (def.meta) continue;
        if (key === def.key || key.toLowerCase() === def.key.toLowerCase()) {
          e.preventDefault();
          def.handler();
          return;
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
