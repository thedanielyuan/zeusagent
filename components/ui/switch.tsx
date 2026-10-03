"use client";

import { Switch as RadixSwitch } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** An on/off control, drawn like MenuSwitch's switch. */
export function Switch({ className, ...props }: ComponentProps<typeof RadixSwitch.Root>) {
  return (
    <RadixSwitch.Root
      className={cn(
        "relative h-5 w-8 shrink-0 rounded-full bg-white/15 transition-colors data-[state=checked]:bg-accent disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadixSwitch.Thumb className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform data-[state=checked]:translate-x-3" />
    </RadixSwitch.Root>
  );
}
