"use client";

import { ArrowDown } from "lucide-react";
import { useEffect, useRef } from "react";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import type { Message } from "@/lib/types";
import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";

interface MessageListProps {
  conversationId: string;
  messages: Message[];
}

export function MessageList({ conversationId, messages }: MessageListProps) {
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom();

  // A new message at the end means the user just sent or regenerated: follow it.
  const lastId = messages.at(-1)?.id;
  const previousLastId = useRef(lastId);
  useEffect(() => {
    if (previousLastId.current === lastId) return;
    previousLastId.current = lastId;
    scrollToBottom("smooth");
  }, [lastId, scrollToBottom]);

  const latestReplyId = messages.findLast((message) => message.role === "assistant")?.id;

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} className="h-full overflow-y-auto">
        <div
          ref={contentRef}
          className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-4 pb-10 md:px-6"
        >
          {messages.map((message) =>
            message.role === "user" ? (
              <UserMessage key={message.id} conversationId={conversationId} message={message} />
            ) : (
              <AssistantMessage
                key={message.id}
                conversationId={conversationId}
                message={message}
                isLatest={message.id === latestReplyId}
              />
            ),
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-t from-app to-transparent" />

      {!isAtBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom("smooth")}
          aria-label="Scroll to bottom"
          className="absolute bottom-4 left-1/2 flex size-9 -translate-x-1/2 animate-fade-in items-center justify-center rounded-full border border-line bg-app text-fg shadow-lg shadow-black/50 transition-colors hover:bg-raised"
        >
          <ArrowDown className="size-4" />
        </button>
      )}
    </div>
  );
}
