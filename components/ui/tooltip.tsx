"use client";

import { Tooltip as RadixTooltip } from "radix-ui";
import type { ReactElement, ReactNode } from "react";

export const TooltipProvider = RadixTooltip.Provider;

export type TooltipSide = "top" | "right" | "bottom" | "left";

interface TooltipProps {
  content: ReactNode;
  side?: TooltipSide;
  children: ReactElement;
}

export function Tooltip({ content, side = "bottom", children }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
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
