export type Role = "user" | "assistant";

export type MessageStatus = "streaming" | "done" | "stopped" | "error";

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  /** Assistant only: the OpenRouter model id that produced the reply. */
  model?: string;
  /** Assistant only: the reasoning effort the model used, if it reasons. */
  effort?: ReasoningEffort;
  /** Assistant only: the model's reasoning, if it shares it (a summary or the full trace). */
  reasoning?: string;
  /** Assistant only: how long the model thought before answering, in ms. */
  thinkingMs?: number;
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
export type ChatStreamEvent =
  | { type: "text"; text: string }
  /** Part of the model's reasoning, which comes before the answer. */
  | { type: "reasoning"; text: string }
  | { type: "error"; message: string };

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

/** OpenRouter's `reasoning.effort` levels. */
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

/** A model's `reasoning` entry in OpenRouter's model list. */
export interface ModelReasoning {
  /** Efforts the model accepts, lowest first. */
  efforts: ReasoningEffort[];
  /** Effort used until the user picks one. */
  defaultEffort: ReasoningEffort;
}

export interface ChatModel {
  /** OpenRouter model id, e.g. "anthropic/claude-sonnet-5.5". */
  id: string;
  name: string;
  provider: string;
  description: string;
  /** Absent for models that can't reason. */
  reasoning?: ModelReasoning;
}
