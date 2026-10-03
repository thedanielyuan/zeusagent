"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

interface ThinkingProps {
  /** The reasoning the model shared so far, if any. */
  reasoning?: string;
  /** True until the answer starts. */
  active: boolean;
  /** How long it thought, once done. */
  durationMs?: number;
}

/**
 * "Thinking…" while the model reasons, then "Thought for 12s". When the model shares its
 * reasoning, the label opens it (live while it's still thinking).
 */
export function Thinking({ reasoning, active, durationMs }: ThinkingProps) {
  const [open, setOpen] = useState(false);

  const label = (
    <span className={cn(active && "shimmer-text")}>
      {active
        ? "Thinking…"
        : durationMs === undefined
          ? "Reasoning"
          : `Thought for ${formatDuration(durationMs)}`}
    </span>
  );

  if (!reasoning) {
    return (
      <div role="status" className="flex h-7 items-center text-sm text-fg-muted">
        {label}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-7 items-center gap-1 text-sm text-fg-muted transition-colors hover:text-fg"
      >
        {label}
        <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="mt-1 mb-2 border-l-2 border-line pl-4 text-sm text-fg-muted">
          <Markdown content={reasoning} />
        </div>
      )}
    </div>
  );
}

/** "8s", "1m 5s". */
function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
