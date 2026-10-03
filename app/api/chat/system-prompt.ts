import { modelName } from "@/lib/models";
import type { ChatMessage, ChatModel, Role } from "@/lib/types";

interface PromptOptions {
  messages: ChatMessage[];
  /** IANA time zone, e.g. "Europe/Paris". */
  timeZone: string;
  webSearch: boolean;
}

/**
 * The messages sent to `model`: the chat, after a system message with what the model can't know on
 * its own (which model it is, and today's date for the user) and how to search the web when that's
 * on. The system message changes once a day at most, or when the user switches models, so providers
 * can keep caching the start of long chats.
 */
export function promptMessages(
  model: ChatModel,
  { messages, timeZone, webSearch }: PromptOptions,
  now = new Date(),
): { role: "system" | Role; content: string }[] {
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
  ].join("\n\n");

  return [
    { role: "system", content: system },
    ...messages.map(({ role, content, model: author }) => ({
      role,
      content: byOtherModel(author) ? `[Reply from ${modelName(author)}]\n\n${content}` : content,
    })),
  ];
}

const SWITCHED =
  'The user switched models during this chat. Replies that start with "[Reply from <model>]" were written by that model, so what they say about themselves is about that model, not you. Zeus adds those labels; don\'t add one to your reply.';

const SEARCH_ON = [
  "You can search the web. Search when the answer depends on current or fast-changing information (news, prices, scores, weather, schedules, recent releases, or anything after your training data) or when the user asks you to look something up; otherwise answer from what you know.",
  "When you use search results, cite them inline right after the sentence they support, as a markdown link labeled with the site's domain, like [reuters.com](https://www.reuters.com/...). Don't add a list of sources at the end; Zeus shows them below your reply.",
].join(" ");

const SEARCH_OFF =
  "Web search is turned off, so you can't look anything up. When the answer depends on information that may have changed since your training data, answer from what you know, say it may be out of date, and mention that the user can turn on Search in the message box.";
