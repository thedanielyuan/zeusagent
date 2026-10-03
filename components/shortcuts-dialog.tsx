"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { IconButton } from "@/components/ui/icon-button";
import { SHORTCUTS, shortcutKeys, useIsMac } from "@/lib/shortcuts";

const ROWS = [
  { label: "New chat", shortcut: SHORTCUTS.newChat },
  { label: "Search chats", shortcut: SHORTCUTS.search },
  { label: "Toggle sidebar", shortcut: SHORTCUTS.toggleSidebar },
  { label: "Send message", shortcut: "enter" },
  { label: "New line", shortcut: "shift+enter" },
];

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const isMac = useIsMac();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 m-auto h-fit w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-line bg-raised p-5 shadow-2xl shadow-black/60 outline-none data-[state=open]:animate-pop-in"
        >
          <div className="mb-2 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">Keyboard shortcuts</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton label="Close" tooltip={false} className="-mr-2 size-8 [&_svg]:size-4">
                <X />
              </IconButton>
            </Dialog.Close>
          </div>
          <dl className="divide-y divide-line">
            {ROWS.map(({ label, shortcut }) => (
              <div key={label} className="flex items-center justify-between py-2.5 text-sm">
                <dt className="text-fg-muted">{label}</dt>
                <dd className="flex gap-1">
                  {shortcutKeys(shortcut, isMac).map((key) => (
                    <kbd
                      key={key}
                      className="min-w-6 rounded-md border border-line bg-surface px-1.5 py-0.5 text-center font-sans text-xs text-fg"
                    >
                      {key}
                    </kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
