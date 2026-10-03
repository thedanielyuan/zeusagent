"use client";

import { PanelLeftClose, PanelLeftOpen, Search, SquarePen, X } from "lucide-react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { IconButton } from "@/components/ui/icon-button";
import { isPlainLeftClick } from "@/lib/navigation";
import { SHORTCUTS, shortcutLabel, useIsMac } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { ConversationList } from "./conversation-list";
import { UserMenu } from "./user-menu";

interface SidebarActions {
  onNewChat: () => void;
  onSearch: () => void;
  onSelectConversation: (conversationId: string) => void;
  onShowShortcuts: () => void;
}

interface SidebarProps extends SidebarActions {
  activeId: string | null;
  /** Desktop: collapsed to an icon rail. */
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** Mobile: the sidebar is a drawer over the chat. */
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export function Sidebar({
  activeId,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
  ...actions
}: SidebarProps) {
  return (
    <>
      <aside
        className={cn(
          "hidden shrink-0 overflow-hidden border-r border-line bg-sidebar transition-[width] duration-200 ease-out md:block",
          collapsed ? "w-[52px]" : "w-[260px]",
        )}
      >
        {collapsed ? (
          <SidebarRail onExpand={() => onCollapsedChange(false)} {...actions} />
        ) : (
          <SidebarPanel
            activeId={activeId}
            className="w-[260px]"
            closeButton={
              <IconButton label="Close sidebar" onClick={() => onCollapsedChange(true)}>
                <PanelLeftClose />
              </IconButton>
            }
            {...actions}
          />
        )}
      </aside>

      <Dialog.Root open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in md:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-[min(85vw,300px)] border-r border-line bg-sidebar outline-none data-[state=closed]:animate-drawer-out data-[state=open]:animate-drawer-in md:hidden"
          >
            <Dialog.Title className="sr-only">Chats</Dialog.Title>
            <SidebarPanel
              activeId={activeId}
              closeButton={
                <Dialog.Close asChild>
                  <IconButton label="Close sidebar" tooltip={false}>
                    <X />
                  </IconButton>
                </Dialog.Close>
              }
              {...actions}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

interface SidebarPanelProps extends SidebarActions {
  activeId: string | null;
  closeButton: ReactNode;
  className?: string;
}

function SidebarPanel({
  activeId,
  closeButton,
  className,
  onNewChat,
  onSearch,
  onSelectConversation,
  onShowShortcuts,
}: SidebarPanelProps) {
  const isMac = useIsMac();

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex h-13 shrink-0 items-center justify-between px-2">
        <Link
          href="/"
          prefetch={false}
          aria-label="Zeus, new chat"
          onClick={(event) => {
            if (!isPlainLeftClick(event)) return;
            event.preventDefault();
            onNewChat();
          }}
          className="flex size-9 items-center justify-center rounded-lg text-fg transition-colors hover:bg-hover"
        >
          <Logo className="size-6" />
        </Link>
        {closeButton}
      </div>

      <div className="shrink-0 px-2">
        <SidebarAction
          icon={<SquarePen />}
          label="New chat"
          shortcut={shortcutLabel(SHORTCUTS.newChat, isMac)}
          onClick={onNewChat}
        />
        <SidebarAction
          icon={<Search />}
          label="Search chats"
          shortcut={shortcutLabel(SHORTCUTS.search, isMac)}
          onClick={onSearch}
        />
      </div>

      <nav aria-label="Chats" className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <ConversationList activeId={activeId} onSelect={onSelectConversation} />
      </nav>

      <div className="shrink-0 border-t border-line p-2">
        <UserMenu onShowShortcuts={onShowShortcuts} />
      </div>
    </div>
  );
}

interface SidebarActionProps {
  icon: ReactNode;
  label: string;
  shortcut: string;
  onClick: () => void;
}

function SidebarAction({ icon, label, shortcut, onClick }: SidebarActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-sm text-fg transition-colors hover:bg-hover focus-visible:-outline-offset-2 [&_svg]:size-[18px]"
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <kbd className="hidden font-sans text-xs text-fg-subtle group-hover:inline">{shortcut}</kbd>
    </button>
  );
}

interface SidebarRailProps extends SidebarActions {
  onExpand: () => void;
}

function SidebarRail({ onExpand, onNewChat, onSearch, onShowShortcuts }: SidebarRailProps) {
  const isMac = useIsMac();
  const withShortcut = (label: string, shortcut: string) => (
    <span className="flex items-center gap-2">
      {label}
      <span className="text-fg-subtle">{shortcutLabel(shortcut, isMac)}</span>
    </span>
  );

  return (
    <div className="flex h-full w-[52px] flex-col items-center gap-1 py-2">
      <IconButton label="Open sidebar" tooltipSide="right" onClick={onExpand} className="group/rail text-fg">
        <Logo className="group-hover/rail:hidden" />
        <PanelLeftOpen className="hidden group-hover/rail:block" />
      </IconButton>
      <IconButton
        label="New chat"
        tooltip={withShortcut("New chat", SHORTCUTS.newChat)}
        tooltipSide="right"
        onClick={onNewChat}
      >
        <SquarePen />
      </IconButton>
      <IconButton
        label="Search chats"
        tooltip={withShortcut("Search chats", SHORTCUTS.search)}
        tooltipSide="right"
        onClick={onSearch}
      >
        <Search />
      </IconButton>
      <div className="mt-auto">
        <UserMenu compact onShowShortcuts={onShowShortcuts} />
      </div>
    </div>
  );
}
