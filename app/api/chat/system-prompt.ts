interface PromptOptions {
  /** IANA time zone, e.g. "Europe/Paris". */
  timeZone: string;
  webSearch: boolean;
}

/**
 * The system message sent before the chat: what the model can't know on its own (today's date for
 * the user) and how to search the web when that's on. It changes once a day at most, so providers
 * can keep caching the start of long chats.
 */
export function systemPrompt({ timeZone, webSearch }: PromptOptions, now = new Date()): string {
  const today = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  return [
    `Today is ${today}. The user's time zone is ${timeZone}. Use the datetime tool when you need the exact time.`,
    webSearch ? SEARCH_ON : SEARCH_OFF,
  ].join("\n\n");
}

const SEARCH_ON = [
  "You can search the web. Search when the answer depends on current or fast-changing information (news, prices, scores, weather, schedules, recent releases, or anything after your training data) or when the user asks you to look something up; otherwise answer from what you know.",
  "When you use search results, cite them inline right after the sentence they support, as a markdown link labeled with the site's domain, like [reuters.com](https://www.reuters.com/...). Don't add a list of sources at the end; Zeus shows them below your reply.",
].join(" ");

const SEARCH_OFF =
  "Web search is turned off, so you can't look anything up. When the answer depends on information that may have changed since your training data, answer from what you know, say it may be out of date, and mention that the user can turn on Search in the message box.";
