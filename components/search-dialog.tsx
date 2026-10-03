"use client";

import { MessageCircle, Search, SquarePen, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { focusComposer } from "@/components/chat/composer";
import { IconButton } from "@/components/ui/icon-button";
import { groupByDate } from "@/lib/dates";
import { useChatStore } from "@/lib/store";
import type { Conversation, Message } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (conversationId: string) => void;
  onNewChat: () => void;
}

export function SearchDialog({ open, onOpenChange, onSelect, onNewChat }: SearchDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            focusComposer();
          }}
          className="fixed inset-x-0 top-[10dvh] z-50 mx-auto flex max-h-[min(75dvh,640px)] w-[calc(100%-2rem)] max-w-[640px] flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-2xl shadow-black/60 outline-none data-[state=open]:animate-pop-in"
        >
          <Dialog.Title className="sr-only">Search chats</Dialog.Title>
          {/* Mounted only while open, so every search starts fresh. */}
          <SearchPanel
            onSelect={(id) => {
              onOpenChange(false);
              onSelect(id);
            }}
            onNewChat={() => {
              onOpenChange(false);
              onNewChat();
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface SearchResult {
  conversation: Conversation;
  /** Matching excerpt when the query matched a message rather than the title. */
  snippet?: string;
}

interface Section {
  label: string;
  items: (SearchResult & { index: number })[];
}

function SearchPanel({ onSelect, onNewChat }: { onSelect: (id: string) => void; onNewChat: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const conversations = useChatStore((state) => state.conversations);
  const messages = useChatStore((state) => state.messages);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const needle = query.trim().toLowerCase();
  // Without a query the first row is "New chat", so results start at index 1.
  const firstResultIndex = needle ? 0 : 1;
  const sections = useMemo(
    () => toSections(search(conversations, messages, needle), firstResultIndex),
    [conversations, messages, needle, firstResultIndex],
  );
  const resultCount = sections.reduce((count, section) => count + section.items.length, 0);
  const rowCount = firstResultIndex + resultCount;

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const choose = (index: number) => {
    if (index < firstResultIndex) return onNewChat();
    for (const section of sections) {
      const item = section.items.find((result) => result.index === index);
      if (item) return onSelect(item.conversation.id);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (rowCount === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + step + rowCount) % rowCount);
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing && rowCount > 0) {
      event.preventDefault();
      choose(activeIndex);
    }
  };

  const optionId = (index: number) => `${listId}-${index}`;

  return (
    <>
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-4">
        <Search className="size-5 shrink-0 text-fg-muted" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search chats..."
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={rowCount > 0 ? optionId(activeIndex) : undefined}
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-fg caret-accent outline-none placeholder:text-fg-subtle"
        />
        <Dialog.Close asChild>
          <IconButton label="Close search" tooltip={false} className="-mr-2">
            <X />
          </IconButton>
        </Dialog.Close>
      </div>

      <div ref={listRef} id={listId} role="listbox" aria-label="Chats" className="min-h-0 flex-1 overflow-y-auto p-2">
        {!needle && (
          <Row
            id={optionId(0)}
            active={activeIndex === 0}
            icon={<SquarePen />}
            onHover={() => setActiveIndex(0)}
            onClick={onNewChat}
          >
            New chat
          </Row>
        )}

        {sections.map((section) => (
          <div key={section.label} role="group" aria-label={section.label}>
            <div className="px-3 pt-4 pb-1.5 text-xs font-medium text-fg-subtle">{section.label}</div>
            {section.items.map(({ conversation, snippet, index }) => (
              <Row
                key={conversation.id}
                id={optionId(index)}
                active={activeIndex === index}
                icon={<MessageCircle />}
                onHover={() => setActiveIndex(index)}
                onClick={() => onSelect(conversation.id)}
                detail={snippet && <Highlight text={snippet} query={needle} />}
              >
                <Highlight text={conversation.title} query={needle} />
              </Row>
            ))}
          </div>
        ))}

        {resultCount === 0 && (
          <p className="px-3 py-8 text-center text-sm text-fg-muted">
            {needle ? "No chats match your search." : "No chats yet."}
          </p>
        )}
      </div>
    </>
  );
}

interface RowProps {
  id: string;
  active: boolean;
  icon: ReactNode;
  detail?: ReactNode;
  onHover: () => void;
  onClick: () => void;
  children: ReactNode;
}

function Row({ id, active, icon, detail, onHover, onClick, children }: RowProps) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      data-active={active}
      onMouseMove={onHover}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 [&_svg]:size-4 [&_svg]:shrink-0",
        active ? "bg-accent-muted text-accent" : "text-fg",
      )}
    >
      <span className={active ? "text-accent" : "text-fg-muted"}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{children}</div>
        {detail && <div className="truncate text-xs text-fg-muted">{detail}</div>}
      </div>
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const start = query ? text.toLowerCase().indexOf(query) : -1;
  if (start === -1) return text;
  const end = start + query.length;
  return (
    <>
      {text.slice(0, start)}
      <mark className="bg-transparent font-semibold text-inherit">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

function search(
  conversations: Record<string, Conversation>,
  messages: Record<string, Message[]>,
  needle: string,
): SearchResult[] {
  const sorted = Object.values(conversations).sort((a, b) => b.updatedAt - a.updatedAt);
  if (!needle) return sorted.map((conversation) => ({ conversation }));

  const results: SearchResult[] = [];
  for (const conversation of sorted) {
    if (conversation.title.toLowerCase().includes(needle)) {
      results.push({ conversation });
      continue;
    }
    for (const message of messages[conversation.id] ?? []) {
      const index = message.content.toLowerCase().indexOf(needle);
      if (index !== -1) {
        results.push({ conversation, snippet: excerpt(message.content, index, needle.length) });
        break;
      }
    }
  }
  return results;
}

/** A one-line excerpt around a match, without markdown punctuation. */
function excerpt(content: string, index: number, length: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(content.length, index + length + 80);
  const text = content.slice(start, end).replace(/[`*#>|]+/g, "").replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${text}${end < content.length ? "…" : ""}`;
}

/** Groups results by date and numbers them in display order for keyboard navigation. */
function toSections(results: SearchResult[], firstIndex: number): Section[] {
  const sections: Section[] = [];
  let index = firstIndex;
  for (const group of groupByDate(results, (result) => result.conversation.updatedAt)) {
    sections.push({
      label: group.label,
      items: group.items.map((result, offset) => ({ ...result, index: index + offset })),
    });
    index += group.items.length;
  }
  return sections;
}
