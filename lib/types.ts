export type Role = "user" | "assistant";

export type MessageStatus = "streaming" | "done" | "stopped" | "error";

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  /** User only: images and PDFs sent with the message. */
  attachments?: Attachment[];
  /** Assistant only: the OpenRouter model id that produced the reply. */
  model?: string;
  /** Assistant only: the reasoning effort the model used, if it reasons. */
  effort?: ReasoningEffort;
  /** Assistant only: the model's reasoning, if it shares it (a summary or the full trace). */
  reasoning?: string;
  /** Assistant only: how long the model thought before answering, in ms. */
  thinkingMs?: number;
  /** Assistant only: pages the model found by searching the web, in the order it found them. */
  sources?: Source[];
  /** Assistant only: images the model created, saved like attachments. */
  images?: Attachment[];
  /** Assistant only: the tokens the reply used and what it cost, once it finished. */
  usage?: Usage;
  /** Assistant only: set when the reply was cut off at the length limit or by a content filter. */
  finishReason?: FinishReason;
  /** Assistant only. */
  status?: MessageStatus;
  error?: string;
  feedback?: "up" | "down";
}

/**
 * An image or PDF sent with a message. The file itself is saved apart from the chats, in
 * IndexedDB (see lib/attachments.ts), since localStorage only holds a few MB.
 */
export interface Attachment {
  id: string;
  /** The file's name, e.g. "receipt.pdf". */
  name: string;
  /** "application/pdf", or the image's type, e.g. "image/png". */
  mimeType: string;
  /** In bytes. */
  size: number;
  /** Images only, in pixels. */
  width?: number;
  height?: number;
}

/** A web page found by a search. */
export interface Source {
  url: string;
  title: string;
}

/** Why a reply ended before the model finished it. */
export type FinishReason = "length" | "content_filter";

/** What a reply used and cost, as OpenRouter reports it. */
export interface Usage {
  /** Tokens sent to the model (the chat so far), including those read from its cache. */
  inputTokens: number;
  /** Input tokens read from the provider's cache, at a discount. */
  cachedTokens: number;
  /** Tokens the model wrote, including its reasoning. */
  outputTokens: number;
  reasoningTokens: number;
  /** In US dollars. */
  cost: number;
}

/** A message as sent to /api/chat. */
export interface ChatMessage {
  role: Role;
  content: string;
  /** User only. */
  attachments?: AttachmentData[];
  /** Assistant only: the OpenRouter model id that wrote the reply (the user can switch models). */
  model?: string;
}

/** An attachment as sent to /api/chat. */
export interface AttachmentData {
  name: string;
  /** The file as a base64 data URL, e.g. "data:application/pdf;base64,…". */
  data: string;
}

/** Events streamed by /api/chat, one JSON object per line. */
export type ChatStreamEvent =
  | { type: "text"; text: string }
  /** Part of the model's reasoning, which comes before the answer. */
  | { type: "reasoning"; text: string }
  /** Pages a web search found, each sent once, before the text that uses them. */
  | { type: "sources"; sources: Source[] }
  /** An image the model created, as a base64 data URL. */
  | { type: "image"; data: string }
  /** Sent last, once the reply is complete. */
  | { type: "end"; usage?: Usage; finishReason?: FinishReason }
  | { type: "error"; message: string };

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /**
   * The model the chat's next replies use. Unset in chats from before Zeus kept one, which go on
   * with the model of their latest reply (see chatModelId).
   */
  modelId?: string;
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
  /** The longest reply the model can write, reasoning included (`max_completion_tokens`). */
  maxOutputTokens: number;
  /** What the model can read (`input_modalities`). Without "file", OpenRouter reads PDFs for it. */
  inputModalities: InputModality[];
}

export type InputModality = "text" | "image" | "file" | "audio" | "video";
