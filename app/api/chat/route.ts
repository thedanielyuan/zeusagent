import { getModel, isEffort } from "@/lib/models";
import type { ChatMessage, ChatStreamEvent, ReasoningEffort } from "@/lib/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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
        messages: body.messages,
        ...(body.effort && { reasoning: { effort: body.effort } }),
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

interface ChatBody {
  model: string;
  effort?: ReasoningEffort;
  messages: ChatMessage[];
}

function parseBody(value: unknown): ChatBody | null {
  if (typeof value !== "object" || value === null) return null;
  const { model, effort, messages } = value as { model?: unknown; effort?: unknown; messages?: unknown };
  if (typeof model !== "string" || !Array.isArray(messages) || messages.length === 0) return null;
  if (effort !== undefined && !isEffort(effort)) return null;

  const valid = messages.every(
    (message: Partial<ChatMessage> | null) =>
      (message?.role === "user" || message?.role === "assistant") &&
      typeof message.content === "string",
  );
  if (!valid) return null;
  return {
    model,
    effort,
    messages: (messages as ChatMessage[]).map(({ role, content }) => ({ role, content })),
  };
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
  choices?: { delta?: { content?: string | null; reasoning?: string | null } }[];
  /** Set when the generation fails after streaming has started (the HTTP status is still 200). */
  error?: { message?: string };
}

/** Turns OpenRouter completion chunks into Zeus stream events, one JSON line each. */
function toChatEvents(): TransformStream<string, string> {
  return new TransformStream({
    transform(data, controller) {
      if (data === "[DONE]") return;
      let chunk: CompletionChunk;
      try {
        chunk = JSON.parse(data) as CompletionChunk;
      } catch {
        return;
      }

      const send = (event: ChatStreamEvent) => controller.enqueue(`${JSON.stringify(event)}\n`);
      if (chunk.error) {
        send({ type: "error", message: chunk.error.message || "The model stopped with an error." });
        return;
      }
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.reasoning) send({ type: "reasoning", text: delta.reasoning });
      if (delta?.content) send({ type: "text", text: delta.content });
    },
  });
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
