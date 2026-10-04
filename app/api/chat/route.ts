import { getModel, isEffort } from "@/lib/models";
import type {
  ChatMessage,
  ChatModel,
  ChatStreamEvent,
  ReasoningEffort,
  Source,
  Usage,
} from "@/lib/types";
import { promptMessages } from "./system-prompt";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * The most tokens a reply may use, reasoning included, when its model allows more. As
 * `max_tokens`, it makes OpenRouter skip providers that would cut replies off sooner (some serve
 * Kimi K3 with a 16K limit), while leaving most of the context window for the chat.
 */
const MAX_REPLY_TOKENS = 128_000;

/**
 * Streams a reply from OpenRouter. The API key stays on the server; the browser receives
 * newline-delimited JSON events (see ChatStreamEvent).
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return errorResponse(500, "OPENROUTER_API_KEY isn't set. Add it to .env.local and restart the server.");
  }

  const body = parseBody(await request.json().catch(() => null));
  if (!body) return errorResponse(400, "Expected a JSON body with a model and messages.");
  // Only the models offered in the picker, so this endpoint can't run arbitrary (possibly
  // expensive) models on the key.
  const model = getModel(body.model);
  if (!model) return errorResponse(400, `Unknown model: ${body.model}`);
  if (body.effort && !model.reasoning?.efforts.includes(body.effort)) {
    return errorResponse(400, `${model.name} doesn't support ${body.effort} reasoning effort.`);
  }

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: body.model,
        messages: promptMessages(model, body),
        ...(body.effort && { reasoning: { effort: body.effort } }),
        max_tokens: Math.min(model.maxOutputTokens, MAX_REPLY_TOKENS),
        tools: serverTools(body),
        ...promptCaching(model),
        // Keeps the chat on one provider, whose cache holds the chat so far, and groups its
        // requests in OpenRouter's logs.
        ...(body.chatId && { session_id: body.chatId }),
        stream: true,
      }),
      // Stops the generation (and its billing) when the browser disconnects, e.g. on "stop".
      signal: request.signal,
    });
  } catch {
    return errorResponse(502, "Couldn't reach OpenRouter. Check your connection and try again.");
  }

  if (!upstream.ok || !upstream.body) {
    return errorResponse(upstream.status, await upstreamErrorMessage(upstream));
  }

  const events = upstream.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(serverSentEventData())
    .pipeThrough(toChatEvents())
    .pipeThrough(new TextEncoderStream());

  return new Response(events, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

/**
 * Every turn sends the whole chat again. The other models cache it on their own, but Claude only
 * when asked: this caches it for 5 minutes, renewed each time it's read, so a follow-up within
 * that time pays a tenth of the input price or less for the chat so far. Writing to the cache
 * costs a quarter more than plain input.
 */
function promptCaching(model: ChatModel) {
  return model.id.startsWith("anthropic/") ? { cache_control: { type: "ephemeral" } } : {};
}

/**
 * Tools that OpenRouter runs for the model, which decides when to call them: a clock, and web
 * search when the user has it on.
 */
function serverTools({ webSearch, timeZone }: ChatBody) {
  const datetime = { type: "openrouter:datetime", parameters: { timezone: timeZone } };
  if (!webSearch) return [datetime];
  return [
    datetime,
    {
      type: "openrouter:web_search",
      parameters: {
        max_results: 5,
        // Each search costs about a cent. Past this, further searches fail and the model answers
        // with what it has.
        max_uses: 5,
        // Favors local results, with providers that run the search themselves.
        user_location: { type: "approximate", timezone: timeZone },
      },
    },
  ];
}

interface ChatBody {
  model: string;
  effort?: ReasoningEffort;
  messages: ChatMessage[];
  /** Whether the model may search the web. */
  webSearch: boolean;
  /** The user's IANA time zone, e.g. "Europe/Paris". */
  timeZone: string;
  /** The chat's id. */
  chatId?: string;
}

function parseBody(value: unknown): ChatBody | null {
  if (typeof value !== "object" || value === null) return null;
  const { model, effort, messages, webSearch, timeZone, chatId } = value as {
    model?: unknown;
    effort?: unknown;
    messages?: unknown;
    webSearch?: unknown;
    timeZone?: unknown;
    chatId?: unknown;
  };
  if (typeof model !== "string" || !Array.isArray(messages) || messages.length === 0) return null;
  if (effort !== undefined && !isEffort(effort)) return null;
  if (webSearch !== undefined && typeof webSearch !== "boolean") return null;
  // OpenRouter's limit for a session id.
  if (chatId !== undefined && (typeof chatId !== "string" || chatId.length > 256)) return null;

  const valid = messages.every(
    (message: Partial<ChatMessage> | null) =>
      (message?.role === "user" || message?.role === "assistant") &&
      typeof message.content === "string" &&
      (message.model === undefined || typeof message.model === "string"),
  );
  if (!valid) return null;
  return {
    model,
    effort,
    messages: (messages as ChatMessage[]).map(({ role, content, model: author }) =>
      role === "assistant" && author ? { role, content, model: author } : { role, content },
    ),
    webSearch: webSearch ?? false,
    // A missing or unknown zone shouldn't fail the reply; the model then gets UTC's date.
    timeZone: canonicalTimeZone(timeZone) ?? "UTC",
    chatId,
  };
}

function canonicalTimeZone(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** Splits a server-sent event stream into each event's `data`, dropping comments (keep-alives). */
function serverSentEventData(): TransformStream<string, string> {
  let buffer = "";
  let data: string[] = [];

  const readLine = (line: string, controller: TransformStreamDefaultController<string>) => {
    if (line === "") {
      // A blank line ends the event.
      if (data.length > 0) controller.enqueue(data.join("\n"));
      data = [];
    } else if (line.startsWith("data:")) {
      data.push(line.slice(5).replace(/^ /, ""));
    }
  };

  return new TransformStream({
    transform(chunk, controller) {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) readLine(line.replace(/\r$/, ""), controller);
    },
    flush(controller) {
      if (buffer) readLine(buffer.replace(/\r$/, ""), controller);
      readLine("", controller);
    },
  });
}

interface CompletionChunk {
  choices?: {
    delta?: {
      content?: string | null;
      reasoning?: string | null;
      /** The pages a web search found, sent when the search finishes. */
      annotations?: Annotation[] | null;
    };
    /** Set on the last chunks: "stop", or "length" and "content_filter" when cut off. */
    finish_reason?: string | null;
  }[];
  /** Sent in the last chunk. */
  usage?: CompletionUsage | null;
  /** Set when the generation fails after streaming has started (the HTTP status is still 200). */
  error?: { message?: string };
}

interface CompletionUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  /** In US dollars. */
  cost?: number;
  prompt_tokens_details?: { cached_tokens?: number } | null;
  completion_tokens_details?: { reasoning_tokens?: number } | null;
}

interface Annotation {
  type?: string;
  url_citation?: { url?: string; title?: string };
}

type TextType = Extract<ChatStreamEvent, { text: string }>["type"];

/** Turns OpenRouter completion chunks into Zeus stream events, one JSON line each. */
function toChatEvents(): TransformStream<string, string> {
  // Several searches can find the same page.
  const sentUrls = new Set<string>();
  // The latest text of each kind, and whether a search has finished since.
  const latest: Record<TextType, string> = { reasoning: "", text: "" };
  const searched: Record<TextType, boolean> = { reasoning: false, text: false };
  // Filled in from the last chunks, and sent once the stream ends.
  const end: Extract<ChatStreamEvent, { type: "end" }> = { type: "end" };

  return new TransformStream({
    transform(data, controller) {
      if (data === "[DONE]") return;
      let chunk: CompletionChunk;
      try {
        chunk = JSON.parse(data) as CompletionChunk;
      } catch {
        return;
      }

      const send = (event: ChatStreamEvent) => controller.enqueue(line(event));
      // What the model writes after a search would run straight on from what it wrote before
      // ("Let me look that up.The answer is…"), so it starts a new paragraph.
      const sendText = (type: TextType, text: string) => {
        const newTurn = searched[type] && /\S$/.test(latest[type]) && /^\S/.test(text);
        searched[type] = false;
        latest[type] = text;
        send({ type, text: newTurn ? `\n\n${text}` : text });
      };

      if (chunk.error) {
        send({ type: "error", message: chunk.error.message || "The model stopped with an error." });
        return;
      }
      const delta = chunk.choices?.[0]?.delta;
      const found = searchResults(delta?.annotations);
      if (found.length > 0) {
        searched.reasoning = searched.text = true;
        const sources = found.filter(({ url }) => {
          if (sentUrls.has(url)) return false;
          sentUrls.add(url);
          return true;
        });
        if (sources.length > 0) send({ type: "sources", sources });
      }
      if (delta?.reasoning) sendText("reasoning", delta.reasoning);
      if (delta?.content) sendText("text", delta.content);

      const finishReason = chunk.choices?.[0]?.finish_reason;
      if (finishReason === "length" || finishReason === "content_filter") {
        end.finishReason = finishReason;
      }
      end.usage = toUsage(chunk.usage) ?? end.usage;
    },
    flush(controller) {
      controller.enqueue(line(end));
    },
  });
}

function line(event: ChatStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/** What the reply used, from a chunk that reports it along with its cost. */
function toUsage(usage: CompletionUsage | null | undefined): Usage | undefined {
  if (typeof usage?.cost !== "number") return undefined;
  return {
    inputTokens: usage.prompt_tokens ?? 0,
    cachedTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
    reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? 0,
    cost: usage.cost,
  };
}

/** The web pages in a chunk's annotations, keeping only http(s) links since the browser renders them. */
function searchResults(annotations: Annotation[] | null | undefined): Source[] {
  const sources: Source[] = [];
  for (const annotation of annotations ?? []) {
    if (annotation.type !== "url_citation") continue;
    const { url = "", title = "" } = annotation.url_citation ?? {};
    const parsed = URL.parse(url);
    if (parsed?.protocol !== "https:" && parsed?.protocol !== "http:") continue;
    sources.push({ url, title: title.replace(/\s+/g, " ").trim() || parsed.hostname });
  }
  return sources;
}

const STATUS_MESSAGES: Record<number, string> = {
  401: "OpenRouter rejected the API key. Check OPENROUTER_API_KEY in .env.local.",
  402: "The OpenRouter account is out of credits.",
  408: "The request to OpenRouter timed out. Try again.",
  429: "OpenRouter is rate limiting requests. Wait a moment and try again.",
  502: "The model is unavailable right now. Try again or pick another model.",
  503: "No provider is available for this model right now. Try another model.",
};

async function upstreamErrorMessage(response: Response): Promise<string> {
  const fallback = STATUS_MESSAGES[response.status] ?? `OpenRouter returned an error (${response.status}).`;
  // OpenRouter's own message for a bad key is less helpful than pointing at the config.
  if (response.status === 401) return fallback;
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message || fallback;
  } catch {
    return fallback;
  }
}

function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
