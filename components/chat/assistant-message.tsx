"use client";

import { ThumbsDown, ThumbsUp, TriangleAlert } from "lucide-react";
import { memo } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { sendMessage, setFeedback } from "@/lib/actions";
import { effortName, modelName } from "@/lib/models";
import type { Attachment, Message, Source } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChatImage } from "./attachments";
import { CopyButton } from "./copy-button";
import {
  CREATED_IMAGE_FIT,
  imageReferenceCount,
  Markdown,
  withoutImageReferences,
} from "./markdown";
import { ReplyCost } from "./reply-cost";
import { SourcesMenu } from "./sources";
import { Thinking } from "./thinking";

const NO_SOURCES: Source[] = [];
const NO_IMAGES: Attachment[] = [];

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
  const waiting = streaming && !message.content;
  const sources = message.sources ?? NO_SOURCES;
  const images = message.images ?? NO_IMAGES;
  // Images the reply doesn't place in its text go after it.
  const unplacedImages = images.slice(imageReferenceCount(message.content));
  const copyText = withoutImageReferences(message.content);
  // While the model reasons or searches on the way to its answer, and afterwards if it shared its
  // reasoning.
  const showThinking =
    Boolean(message.reasoning) ||
    (waiting && (sources.length > 0 || (message.effort !== undefined && message.effort !== "none")));

  return (
    <div className="group flex flex-col gap-2">
      {showThinking && (
        <Thinking
          reasoning={message.reasoning}
          active={waiting}
          sources={sources}
          durationMs={message.thinkingMs}
        />
      )}
      {waiting ? (
        !showThinking && (
          <span role="status" aria-label="Generating a reply" className="flex h-7 items-center">
            <span className="size-3.5 animate-pulse-dot rounded-full bg-fg" />
          </span>
        )
      ) : message.content ? (
        <Markdown content={message.content} images={images} />
      ) : (
        message.status === "stopped" && <p className="text-sm text-fg-subtle italic">Stopped</p>
      )}

      {unplacedImages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unplacedImages.map((image) => (
            <ChatImage key={image.id} image={image} fit={CREATED_IMAGE_FIT} />
          ))}
        </div>
      )}

      {message.finishReason && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-fg-muted">
          {message.finishReason === "length"
            ? "This reply hit the length limit and was cut off."
            : "The provider's content filter stopped this reply."}
          {message.finishReason === "length" && isLatest && message.content && (
            <button
              type="button"
              onClick={() => sendMessage(conversationId, "Continue")}
              className="h-8 rounded-full border border-line px-3.5 font-medium text-fg transition-colors hover:bg-hover"
            >
              Continue
            </button>
          )}
        </div>
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
              // Also stays visible while the sources menu is open, since the menu is outside the reply.
              "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100",
          )}
        >
          {copyText && <CopyButton text={copyText} />}
          {(message.content || images.length > 0) && (
            <>
              <FeedbackButton conversationId={conversationId} message={message} value="up" />
              <FeedbackButton conversationId={conversationId} message={message} value="down" />
            </>
          )}
          {sources.length > 0 && <SourcesMenu sources={sources} />}
          {message.model && (
            // The model's name gives way first on narrow screens, keeping the cost in view.
            <span className="ml-2 flex min-w-0 text-xs whitespace-pre text-fg-subtle">
              <span className="truncate">
                {modelName(message.model)}
                {message.effort && ` · ${effortName(message.effort)}`}
              </span>
              {message.usage && (
                <>
                  {" · "}
                  <ReplyCost usage={message.usage} createdImages={images.length > 0} />
                </>
              )}
            </span>
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
