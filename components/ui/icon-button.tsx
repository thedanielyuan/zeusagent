"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, type TooltipSide } from "./tooltip";

interface IconButtonProps extends ComponentProps<"button"> {
  /** Accessible name, also shown as the tooltip unless `tooltip` is set. */
  label: string;
  /** Tooltip content, or false for none (menu triggers, dialog close buttons). */
  tooltip?: ReactNode | false;
  tooltipSide?: TooltipSide;
}

export function IconButton({
  label,
  tooltip,
  tooltipSide,
  className,
  children,
  ...props
}: IconButtonProps) {
  const button = (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-5",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );

  if (tooltip === false) return button;
  return (
    <Tooltip content={tooltip ?? label} side={tooltipSide}>
      {button}
    </Tooltip>
  );
}
