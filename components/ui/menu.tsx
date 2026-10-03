"use client";

import { Check } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          "z-50 min-w-[200px] origin-(--radix-dropdown-menu-content-transform-origin) rounded-2xl border border-line bg-raised p-1.5 text-fg shadow-xl shadow-black/60 outline-none data-[state=open]:animate-pop-in",
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

export const menuItemClass =
  "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

export function MenuItem({
  className,
  destructive,
  ...props
}: ComponentProps<typeof DropdownMenu.Item> & { destructive?: boolean }) {
  return (
    <DropdownMenu.Item
      className={cn(
        menuItemClass,
        destructive && "text-red-400 data-[highlighted]:bg-red-500/10",
        className,
      )}
      {...props}
    />
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="-mx-1.5 my-1.5 h-px bg-line" />;
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label
      className={cn("px-2.5 pt-1.5 pb-1 text-xs font-medium text-fg-subtle", className)}
      {...props}
    />
  );
}

export const MenuRadioGroup = DropdownMenu.RadioGroup;

interface MenuOptionProps extends ComponentProps<typeof DropdownMenu.RadioItem> {
  label: ReactNode;
  description: ReactNode;
  /** Shown small after the label, e.g. "Default". */
  note?: ReactNode;
}

/** A MenuRadioGroup choice with a one-line description, marked in the accent color when picked. */
export function MenuOption({ label, description, note, className, ...props }: MenuOptionProps) {
  return (
    <DropdownMenu.RadioItem
      className={cn(
        "group flex cursor-pointer select-none items-center gap-3 rounded-lg px-2.5 py-2 outline-none data-[highlighted]:bg-hover",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-sm font-medium text-fg group-data-[state=checked]:text-accent">
          {label}
          {note && <span className="text-xs font-normal text-fg-subtle">{note}</span>}
        </div>
        <div className="truncate text-xs text-fg-muted">{description}</div>
      </div>
      <DropdownMenu.ItemIndicator>
        <Check className="size-4 text-accent" />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}
