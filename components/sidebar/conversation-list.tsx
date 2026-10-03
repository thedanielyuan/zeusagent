"use client";

import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { deleteConversation, renameConversation } from "@/lib/actions";
import { groupByDate } from "@/lib/dates";
import { chatHref, isPlainLeftClick, navigate } from "@/lib/navigation";
import { useChatStore } from "@/lib/store";
import type { Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  activeId: string | null;
  onSelect: (conversationId: string) => void;
}

export function ConversationList({ activeId, onSelect }: ConversationListProps) {
  const hydrated = useChatStore((state) => state.hydrated);
  const conversations = useChatStore((state) => state.conversations);
  const groups = useMemo(
    () =>
      groupByDate(
        Object.values(conversations).sort((a, b) => b.updatedAt - a.updatedAt),
        (conversation) => conversation.updatedAt,
      ),
    [conversations],
  );

  if (!hydrated) return null;

  return groups.map((group) => (
    <section key={group.label} className="mt-5 first:mt-1">
      <h2 className="px-2.5 pb-1 text-xs font-medium text-fg-subtle">{group.label}</h2>
      <ul>
        {group.items.map((conversation) => (
          <li key={conversation.id}>
            <ConversationItem
              conversation={conversation}
              active={conversation.id === activeId}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
    </section>
  ));
}

interface ConversationItemProps {
  conversation: Conversation;
  active: boolean;
  onSelect: (conversationId: string) => void;
}

function ConversationItem({ conversation, active, onSelect }: ConversationItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const renameRequested = useRef(false);

  if (renaming) {
    return (
      <RenameInput
        initialValue={conversation.title}
        onDone={(title) => {
          if (title !== null) renameConversation(conversation.id, title);
          setRenaming(false);
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        "group relative flex items-center rounded-[10px] text-sm transition-colors",
        active ? "bg-accent-muted text-accent" : "text-fg hover:bg-hover",
        menuOpen && !active && "bg-hover",
      )}
    >
      <a
        href={chatHref(conversation.id)}
        aria-current={active ? "page" : undefined}
        onClick={(event) => {
          if (!isPlainLeftClick(event)) return;
          event.preventDefault();
          onSelect(conversation.id);
        }}
        className={cn(
          "flex h-9 min-w-0 flex-1 items-center rounded-[10px] px-2.5 focus-visible:-outline-offset-2 group-hover:pr-9 [@media(hover:none)]:pr-9",
          (active || menuOpen) && "pr-9",
        )}
      >
        <span className="truncate">{conversation.title}</span>
      </a>

      <Menu open={menuOpen} onOpenChange={setMenuOpen}>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label={`Options for ${conversation.title}`}
            className={cn(
              "absolute right-1 flex size-7 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100 hover:bg-hover focus-visible:opacity-100 focus-visible:-outline-offset-2 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100",
              active ? "text-accent opacity-100" : "text-fg-muted hover:text-fg",
            )}
          >
            <Ellipsis className="size-4" />
          </button>
        </MenuTrigger>
        <MenuContent
          align="start"
          className="min-w-[160px]"
          // Let the rename field take focus instead of the (now unmounted) trigger.
          onCloseAutoFocus={(event) => {
            if (renameRequested.current) event.preventDefault();
            renameRequested.current = false;
          }}
        >
          <MenuItem
            onSelect={() => {
              renameRequested.current = true;
              setRenaming(true);
            }}
          >
            <Pencil /> Rename
          </MenuItem>
          <MenuItem destructive onSelect={() => setConfirmingDelete(true)}>
            <Trash2 /> Delete
          </MenuItem>
        </MenuContent>
      </Menu>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete chat?"
        description={
          <>
            This will delete <strong className="font-semibold text-fg">{conversation.title}</strong>.
          </>
        }
        confirmLabel="Delete"
        onConfirm={() => {
          deleteConversation(conversation.id);
          if (active) navigate("/", { replace: true });
        }}
      />
    </div>
  );
}

interface RenameInputProps {
  initialValue: string;
  /** Called with the new title, or null when cancelled. */
  onDone: (title: string | null) => void;
}

function RenameInput({ initialValue, onDone }: RenameInputProps) {
  const [value, setValue] = useState(initialValue);
  const done = useRef(false);

  const finish = (title: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(title);
  };

  return (
    <input
      autoFocus
      value={value}
      aria-label="Chat title"
      onChange={(event) => setValue(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={() => finish(value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") finish(value);
        if (event.key === "Escape") finish(null);
      }}
      className="h-9 w-full rounded-[10px] border border-accent/60 bg-surface px-2.5 text-sm text-fg caret-accent outline-none"
    />
  );
}
