"use client";

import { Keyboard, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { deleteAllConversations } from "@/lib/actions";
import { navigate } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  /** Avatar only, for the collapsed sidebar. */
  compact?: boolean;
  onShowShortcuts: () => void;
}

/** Account menu. A placeholder until sign-in exists. */
export function UserMenu({ compact = false, onShowShortcuts }: UserMenuProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="Account menu"
            className={cn(
              "flex items-center gap-2.5 rounded-[10px] text-sm text-fg transition-colors hover:bg-hover data-[state=open]:bg-hover",
              compact ? "size-9 justify-center" : "w-full p-2",
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-xs font-semibold">
              G
            </span>
            {!compact && <span className="truncate font-medium">Guest</span>}
          </button>
        </MenuTrigger>
        <MenuContent side="top" align="start" className="w-[232px]">
          <MenuItem onSelect={onShowShortcuts}>
            <Keyboard /> Keyboard shortcuts
          </MenuItem>
          <MenuSeparator />
          <MenuItem destructive onSelect={() => setConfirmingDelete(true)}>
            <Trash2 /> Delete all chats
          </MenuItem>
        </MenuContent>
      </Menu>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete all chats?"
        description="This permanently deletes every chat saved in this browser."
        confirmLabel="Delete all"
        onConfirm={() => {
          deleteAllConversations();
          navigate("/", { replace: true });
        }}
      />
    </>
  );
}
