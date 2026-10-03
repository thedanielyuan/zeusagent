"use client";

import type { ReactElement } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteAllConversations } from "@/lib/actions";
import { navigate } from "@/lib/navigation";

interface DeleteAllChatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opens the dialog, which gets focus back when it closes. */
  trigger?: ReactElement;
}

/** Asks before deleting every saved chat, then goes back to a new chat. */
export function DeleteAllChatsDialog({ open, onOpenChange, trigger }: DeleteAllChatsDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title="Delete all chats?"
      description="This permanently deletes every chat saved in this browser."
      confirmLabel="Delete all"
      onConfirm={() => {
        deleteAllConversations();
        navigate("/", { replace: true });
      }}
    />
  );
}
