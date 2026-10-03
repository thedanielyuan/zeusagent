"use client";

import { RefreshCw, ThumbsDown, ThumbsUp, TriangleAlert } from "lucide-react";
import { memo } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { regenerate, setFeedback } from "@/lib/actions";
import { modelName } from "@/lib/models";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";
import { Markdown } from "./markdown";

interface AssistantMessageProps {
  conversationId: string;
  message: Message;
  /** The latest reply keeps its actions visible; older ones show them on hover. */
  isLatest: boolean;
}

export const AssistantMessage = memo(function AssistantMessage({
  conversationId,
  message,
  isLatest,
}: AssistantMessageProps) {
  const streaming = message.status === "streaming";

  return (
    <div className="group flex flex-col gap-2">
      {streaming && !message.content ? (
        <span role="status" aria-label="Generating a reply" className="flex h-7 items-center">
          <span className="size-3.5 animate-pulse-dot rounded-full bg-fg" />
        </span>
      ) : message.content ? (
        <Markdown content={message.content} />
      ) : (
        message.status === "stopped" && <p className="text-sm text-fg-subtle italic">Stopped</p>
      )}

      {message.status === "error" && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-400" />
          <span>{message.error ?? "Something went wrong."}</span>
        </div>
      )}

      {!streaming && (
        <div
          className={cn(
            "-ml-2 flex items-center transition-opacity",
            !isLatest &&
              "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
          )}
        >
          {message.content && (
            <>
              <CopyButton text={message.content} />
              <FeedbackButton conversationId={conversationId} message={message} value="up" />
              <FeedbackButton conversationId={conversationId} message={message} value="down" />
            </>
          )}
          <IconButton
            label="Regenerate"
            onClick={() => regenerate(conversationId, message.id)}
            className="size-8 [&_svg]:size-4"
          >
            <RefreshCw />
          </IconButton>
          {message.model && (
            <span className="ml-2 truncate text-xs text-fg-subtle">{modelName(message.model)}</span>
          )}
        </div>
      )}
    </div>
  );
});

interface FeedbackButtonProps {
  conversationId: string;
  message: Message;
  value: "up" | "down";
}

function FeedbackButton({ conversationId, message, value }: FeedbackButtonProps) {
  const selected = message.feedback === value;
  const Icon = value === "up" ? ThumbsUp : ThumbsDown;
  return (
    <IconButton
      label={value === "up" ? "Good response" : "Bad response"}
      aria-pressed={selected}
      onClick={() => setFeedback(conversationId, message.id, value)}
      className={cn("size-8 [&_svg]:size-4", selected && "text-accent hover:text-accent")}
    >
      <Icon className={cn(selected && "fill-current")} />
    </IconButton>
  );
}
