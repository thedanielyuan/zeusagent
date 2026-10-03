import type { ChatMessage, ChatStreamEvent, ReasoningEffort } from "./types";

/** A piece of the reply: its text, or the model's reasoning before it. */
export type ReplyChunk = Exclude<ChatStreamEvent, { type: "error" }>;

export interface ChatRequest {
  /** OpenRouter model id. */
  model: string;
  /** Omitted for models that can't reason. */
  effort?: ReasoningEffort;
  messages: ChatMessage[];
  signal: AbortSignal;
}

/**
 * Streams an assistant reply from /api/chat (which proxies OpenRouter) in chunks.
 * Throws with a readable message when the request fails; aborting `signal` stops the reply.
 */
export async function* streamChat(request: ChatRequest): AsyncGenerator<ReplyChunk> {
  const { model, effort, messages, signal } = request;
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, effort, messages }),
    signal,
  });
  if (!response.ok || !response.body) throw new Error(await errorMessage(response));

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line) continue;
        const event = JSON.parse(line) as ChatStreamEvent;
        if (event.type === "error") throw new Error(event.message);
        yield event;
      }
    }
  } finally {
    // Closes the connection when we stop early, which also stops the generation upstream.
    reader.cancel().catch(() => {});
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // Not a JSON error body.
  }
  return `Request failed (${response.status}).`;
}
