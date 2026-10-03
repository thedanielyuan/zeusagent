export type Role = "user" | "assistant";

export type MessageStatus = "streaming" | "done" | "stopped" | "error";

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  /** Assistant only: the OpenRouter model id that produced the reply. */
  model?: string;
  /** Assistant only. */
  status?: MessageStatus;
  error?: string;
  feedback?: "up" | "down";
}

/** A message as sent to the model. */
export interface ChatMessage {
  role: Role;
  content: string;
}

/** Events streamed by /api/chat, one JSON object per line. */
export type ChatStreamEvent = { type: "text"; text: string } | { type: "error"; message: string };

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatModel {
  /** OpenRouter model id, e.g. "anthropic/claude-sonnet-5.5". */
  id: string;
  name: string;
  provider: string;
  description: string;
}
