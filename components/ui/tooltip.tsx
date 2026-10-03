"use client";

import { Tooltip as RadixTooltip } from "radix-ui";
import { useRef, useState, type ReactElement, type ReactNode } from "react";

export const TooltipProvider = RadixTooltip.Provider;

export type TooltipSide = "top" | "right" | "bottom" | "left";

interface TooltipProps {
  content: ReactNode;
  side?: TooltipSide;
  children: ReactElement;
}

export function Tooltip({ content, side = "bottom", children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <RadixTooltip.Root
      open={open}
      // Not while the trigger's menu is open, which a quick click opens before the hover delay ends.
      onOpenChange={(next) => setOpen(next && !triggerRef.current?.matches("[aria-expanded=true]"))}
    >
      <RadixTooltip.Trigger ref={triggerRef} asChild>
        {children}
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-50 select-none rounded-lg border border-line bg-raised px-2 py-1 text-xs font-medium text-fg shadow-lg shadow-black/50 data-[state=delayed-open]:animate-fade-in"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
