import type { ChatMessage, ChatStreamEvent } from "./types";

export interface ChatRequest {
  /** OpenRouter model id. */
  model: string;
  messages: ChatMessage[];
  signal: AbortSignal;
}

/**
 * Streams an assistant reply from /api/chat (which proxies OpenRouter) as text chunks.
 * Throws with a readable message when the request fails; aborting `signal` stops the reply.
 */
export async function* streamChat({ model, messages, signal }: ChatRequest): AsyncGenerator<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
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
        yield event.text;
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
