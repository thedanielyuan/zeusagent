"use client";

import { Database, Settings, X } from "lucide-react";
import { Dialog, Tabs } from "radix-ui";
import { useState, type ReactNode } from "react";
import { focusComposer } from "@/components/chat/composer";
import { EffortSelector, ModelSelector, useCurrentModel } from "@/components/chat/model-selector";
import { DeleteAllChatsDialog } from "@/components/delete-all-chats-dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Switch } from "@/components/ui/switch";
import { setWebSearch } from "@/lib/actions";
import { useChatStore } from "@/lib/store";

const SECTIONS = [
  { id: "general", label: "General", icon: Settings, Panel: GeneralSettings },
  { id: "data", label: "Data controls", icon: Database, Panel: DataControls },
];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          // Back to the message box. Radix would focus the settings button, which pops up its tooltip.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            focusComposer();
          }}
          className="fixed inset-0 z-50 m-auto flex h-[min(26rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-2xl shadow-black/60 outline-none data-[state=open]:animate-pop-in"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line pr-3 pl-5">
            <Dialog.Title className="text-base font-semibold">Settings</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton label="Close" tooltip={false} className="size-8 [&_svg]:size-4">
                <X />
              </IconButton>
            </Dialog.Close>
          </div>

          {/* Mounted only while open, so it always opens on the first section. Sections are a
              column beside the settings, or a row above them on phones. */}
          <Tabs.Root
            defaultValue={SECTIONS[0].id}
            orientation="vertical"
            className="flex min-h-0 flex-1 flex-col sm:flex-row"
          >
            <Tabs.List
              aria-label="Settings sections"
              className="flex shrink-0 gap-1 overflow-x-auto border-b border-line p-2 sm:w-48 sm:flex-col sm:border-r sm:border-b-0"
            >
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <Tabs.Trigger
                  key={id}
                  value={id}
                  className="flex h-9 shrink-0 items-center gap-2.5 rounded-[10px] px-2.5 text-sm whitespace-nowrap text-fg transition-colors focus-visible:-outline-offset-2 data-[state=active]:bg-accent-muted data-[state=active]:text-accent data-[state=inactive]:hover:bg-hover [&_svg]:size-4 [&_svg]:shrink-0"
                >
                  <Icon />
                  {label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {SECTIONS.map(({ id, Panel }) => (
              <Tabs.Content
                key={id}
                value={id}
                className="min-h-0 flex-1 divide-y divide-line overflow-y-auto px-5 py-1 focus-visible:-outline-offset-2"
              >
                <Panel />
              </Tabs.Content>
            ))}
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function GeneralSettings() {
  const hydrated = useChatStore((state) => state.hydrated);
  const webSearch = useChatStore((state) => state.webSearch);
  const { reasoning } = useCurrentModel();

  return (
    <>
      <Setting label="Model" description="Used for new replies">
        <ModelSelector side="bottom" />
      </Setting>
      {reasoning && (
        <Setting label="Reasoning effort" description="How long the model thinks before it answers">
          <EffortSelector side="bottom" />
        </Setting>
      )}
      <Setting label="Web search" description="Lets models search the web when a question needs it">
        {/* Disabled until the saved choice loads, since a change before then would overwrite the
            saved chats. */}
        <Switch
          aria-label="Web search"
          checked={webSearch}
          onCheckedChange={setWebSearch}
          disabled={!hydrated}
        />
      </Setting>
    </>
  );
}

function DataControls() {
  const hasChats = useChatStore(
    (state) => state.hydrated && Object.keys(state.conversations).length > 0,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <Setting label="Delete all chats" description="Permanently deletes every chat saved in this browser">
      <DeleteAllChatsDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        trigger={
          <button
            type="button"
            disabled={!hasChats}
            className="h-9 shrink-0 rounded-full border border-red-500/40 px-4 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:pointer-events-none disabled:opacity-40"
          >
            Delete all
          </button>
        }
      />
    </Setting>
  );
}

interface SettingProps {
  label: string;
  description: string;
  /** The control that changes the setting. */
  children: ReactNode;
}

/** One setting: its name and what it does, with its control on the right. */
function Setting({ label, description, children }: SettingProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex-1">
        <div className="text-sm text-fg">{label}</div>
        <div className="mt-0.5 text-xs leading-5 text-fg-muted">{description}</div>
      </div>
      {children}
    </div>
  );
}
