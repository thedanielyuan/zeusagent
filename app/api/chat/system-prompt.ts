import { canSearchX, modelName } from "@/lib/models";
import type { AttachmentData, ChatMessage, ChatModel, Role } from "@/lib/types";

interface PromptOptions {
  messages: ChatMessage[];
  /** IANA time zone, e.g. "Europe/Paris". */
  timeZone: string;
  webSearch: boolean;
  /** Whether Grok's web search also searches posts on X (see canSearchX). */
  xSearch: boolean;
}

/** A piece of a message for OpenRouter: its text, an image, or a file such as a PDF. */
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

/**
 * The messages sent to `model`: the chat, with the images and PDFs sent in it, after a system
 * message with what the model can't know on its own (which model it is, today's date for the user,
 * and which tools it has). The system message changes once a day at most, or when the user switches
 * models or tools, so providers can keep caching the start of long chats.
 */
export function promptMessages(
  model: ChatModel,
  { messages, timeZone, webSearch, xSearch }: PromptOptions,
  now = new Date(),
): { role: "system" | Role; content: string | ContentPart[] }[] {
  // Replies another model wrote before the user switched to this one. Unlabeled, they would read
  // as this model's own, and it would keep to what they said about themselves ("I'm not Grok").
  const byOtherModel = (author: string | undefined): author is string =>
    author !== undefined && author !== model.id;

  const today = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  const system = [
    // Without this, models guess who they are, and some guess wrong: they claim to be another
    // company's model, or decide they can't be themselves because Zeus lacks a feature of their
    // maker's own app (Grok without X search).
    `You are ${model.name}, an AI model made by ${model.provider}. The user is talking to you in Zeus, a chat app where they can switch between models from different companies. Zeus isn't your maker's own app, so you only have the tools it gives you.`,
    ...(messages.some((message) => byOtherModel(message.model)) ? [SWITCHED] : []),
    `Today is ${today}. The user's time zone is ${timeZone}. Use the datetime tool when you need the exact time.`,
    webSearch ? SEARCH_ON : SEARCH_OFF,
    ...(webSearch && canSearchX(model) ? [xSearch ? X_SEARCH_ON : X_SEARCH_OFF] : []),
    IMAGES,
  ].join("\n\n");

  return [
    { role: "system", content: system },
    ...messages.map(({ role, content, model: author, attachments }) => {
      if (attachments?.length) return { role, content: withAttachments(content, attachments) };
      return {
        role,
        content: byOtherModel(author) ? `[Reply from ${modelName(author)}]\n\n${content}` : content,
      };
    }),
  ];
}

export function isPdf({ data }: AttachmentData): boolean {
  return data.startsWith("data:application/pdf;");
}

/** The message's text, then its images and PDFs, the order OpenRouter recommends. */
function withAttachments(text: string, attachments: AttachmentData[]): ContentPart[] {
  const parts: ContentPart[] = text ? [{ type: "text", text }] : [];
  for (const attachment of attachments) {
    parts.push(
      isPdf(attachment)
        ? { type: "file", file: { filename: attachment.name, file_data: attachment.data } }
        : { type: "image_url", image_url: { url: attachment.data } },
    );
  }
  return parts;
}

const SWITCHED =
  'The user switched models during this chat. Replies that start with "[Reply from <model>]" were written by that model, so what they say about themselves is about that model, not you. Zeus adds those labels; don\'t add one to your reply.';

const SEARCH_ON = [
  "You can search the web, and open a web page or PDF from its URL, such as a link the user shares. Search when the answer depends on current or fast-changing information (news, prices, scores, weather, schedules, recent releases, or anything after your training data) or when the user asks you to look something up; otherwise answer from what you know.",
  "When you use search results, cite them inline right after the sentence they support, as a markdown link labeled with the site's domain, like [reuters.com](https://www.reuters.com/...). Don't add a list of sources at the end; Zeus shows them below your reply.",
].join(" ");

const SEARCH_OFF =
  "Web search is turned off, so you can't look anything up or open links. When the answer depends on information that may have changed since your training data, answer from what you know, say it may be out of date, and mention that the user can turn on Web search in the + menu of the message box.";

const IMAGES =
  "You can create images with the image generation tool when the user asks for one. Zeus shows the images you create with your reply.";

const X_SEARCH_ON = "Your web search can also search posts on X.";

const X_SEARCH_OFF =
  "X search is turned off, so you can't search posts on X. When the user asks about posts on X, mention that they can turn on X search in the + menu of the message box.";
