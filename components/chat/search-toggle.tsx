"use client";

import { Globe } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { setWebSearch } from "@/lib/actions";
import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { pillClass } from "./model-selector";

/** Turns web search on or off for new replies. When it's on, the model decides when to search. */
export function SearchToggle() {
  const hydrated = useChatStore((state) => state.hydrated);
  const on = useChatStore((state) => state.webSearch);

  return (
    <Tooltip content={on ? "Web search is on" : "Web search is off"}>
      <button
        type="button"
        aria-label="Web search"
        aria-pressed={on}
        onClick={() => setWebSearch(!on)}
        className={cn(
          pillClass,
          "shrink-0",
          on && "bg-accent-muted text-accent hover:bg-accent-muted hover:text-accent-hover",
          // Hidden until the saved choice loads, so it doesn't flash the default.
          !hydrated && "invisible",
        )}
      >
        <Globe />
        <span className="@max-[25rem]/composer:hidden">Search</span>
      </button>
    </Tooltip>
  );
}
