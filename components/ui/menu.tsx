"use client";

import { DropdownMenu } from "radix-ui";
import type { ComponentProps } from "react";
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
