"use client";

import { Code, Lightbulb, Menu as MenuIcon, Plane, Scale, SquarePen } from "lucide-react";
import { useCallback, useEffect } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { sendMessage, stopGenerating } from "@/lib/actions";
import type { PendingAttachment } from "@/lib/attachments";
import { chatHref, navigate } from "@/lib/navigation";
import { useChatStore } from "@/lib/store";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { MessageList } from "./message-list";

const NO_MESSAGES: Message[] = [];

const SUGGESTIONS = [
  {
    icon: Code,
    label: "Write code",
    prompt: "Write a TypeScript debounce function and explain how it works.",
  },
  { icon: Lightbulb, label: "Brainstorm", prompt: "Brainstorm names for a productivity app." },
  { icon: Plane, label: "Plan a trip", prompt: "Plan a 3-day trip to Lisbon." },
  { icon: Scale, label: "Compare", prompt: "Compare REST, GraphQL and gRPC in a table." },
];

interface ChatViewProps {
  /** Null on the new-chat screen. */
  conversationId: string | null;
  onOpenSidebar: () => void;
  onNewChat: () => void;
}

export function ChatView({ conversationId, onOpenSidebar, onNewChat }: ChatViewProps) {
  const hydrated = useChatStore((state) => state.hydrated);
  const exists = useChatStore(
    (state) => conversationId !== null && conversationId in state.conversations,
  );
  const messages =
    useChatStore((state) => (conversationId ? state.messages[conversationId] : undefined)) ??
    NO_MESSAGES;
  const generating = messages.at(-1)?.status === "streaming";
  const isNewChat = conversationId === null;

  // Unknown chat (deleted, or saved in another browser): show a new chat instead.
  useEffect(() => {
    if (hydrated && conversationId && !exists) navigate("/", { replace: true });
  }, [hydrated, conversationId, exists]);

  const send = useCallback(
    (text: string, attachments?: PendingAttachment[]) => {
      // Writing before saved chats load would overwrite them.
      if (!useChatStore.getState().hydrated) return;
      const id = sendMessage(conversationId, text, attachments);
      if (id !== conversationId) navigate(chatHref(id), { replace: true });
    },
    [conversationId],
  );

  const stop = useCallback(() => {
    if (conversationId) stopGenerating(conversationId);
  }, [conversationId]);

  // The composer keeps the same position in the tree on both screens, so it stays mounted
  // (and focused) when the first message turns the new chat into a conversation. On wider
  // new-chat screens the space above and below it splits 41:59, which puts its top about 42% of
  // the way down, where ChatGPT puts it.
  return (
    <main className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex h-13 shrink-0 items-center justify-between px-2">
        <IconButton label="Open sidebar" onClick={onOpenSidebar} className="md:hidden">
          <MenuIcon />
        </IconButton>
        <IconButton label="New chat" onClick={onNewChat} className="md:hidden">
          <SquarePen />
        </IconButton>
      </header>

      {isNewChat ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-4 md:flex-41 md:justify-end md:pb-8">
          <h1 className="text-center text-[28px] leading-tight font-medium tracking-tight text-fg">
            What can I help with?
          </h1>
          <Suggestions onPick={send} className="md:hidden" />
        </div>
      ) : (
        <MessageList key={conversationId} conversationId={conversationId} messages={messages} />
      )}

      <div className={cn("mx-auto w-full max-w-3xl shrink-0 px-3 md:px-4", isNewChat ? "pb-4" : "pb-2")}>
        <Composer
          draftKey={conversationId ?? "new"}
          generating={generating}
          onSend={send}
          onStop={stop}
        />
        {!isNewChat && (
          <p className="pt-2 text-center text-xs text-fg-subtle">
            Zeus can make mistakes. Check important info.
          </p>
        )}
      </div>

      {isNewChat && (
        <div className="hidden flex-59 justify-center px-4 pt-4 md:flex">
          <Suggestions onPick={send} className="h-fit" />
        </div>
      )}
    </main>
  );
}

function Suggestions({ onPick, className }: { onPick: (prompt: string) => void; className?: string }) {
  return (
    <div className={cn("flex flex-wrap justify-center gap-2", className)}>
      {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
        <button
          key={label}
          type="button"
          onClick={() => onPick(prompt)}
          className="flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-sm text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
