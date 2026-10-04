import {
  attachmentData,
  deleteAttachmentsExcept,
  saveAttachment,
  saveCreatedImage,
  type PendingAttachment,
} from "./attachments";
import { streamChat, type ReplyChunk } from "./chat-api";
import { getModel, resolveEffort } from "./models";
import { chatModelId, useChatStore } from "./store";
import type { ChatMessage, Message, ReasoningEffort } from "./types";
import { createId } from "./utils";

const { getState, setState } = useChatStore;

/** Replies currently streaming, by conversation id. */
const controllers = new Map<string, AbortController>();

/**
 * Picks the model for a chat's next replies (null: the new-chat screen). It's also the model new
 * chats start with.
 */
export function setModel(modelId: string, conversationId: string | null) {
  setState((state) => {
    const conversation = conversationId ? state.conversations[conversationId] : undefined;
    if (!conversation) return { modelId };
    return {
      modelId,
      conversations: { ...state.conversations, [conversation.id]: { ...conversation, modelId } },
    };
  });
}

export function setEffort(effort: ReasoningEffort) {
  setState({ effort });
}

export function setWebSearch(webSearch: boolean) {
  setState({ webSearch });
}

export function setXSearch(xSearch: boolean) {
  setState({ xSearch });
}

/**
 * Sends a message, with any files attached to it, starting a new conversation when
 * `conversationId` is null. Returns the conversation's id.
 */
export function sendMessage(
  conversationId: string | null,
  content: string,
  attachments: PendingAttachment[] = [],
): string {
  const existing = conversationId !== null && conversationId in getState().conversations;
  // One reply at a time per conversation.
  if (existing && controllers.has(conversationId)) return conversationId;

  const text = content.trim();
  const now = Date.now();
  const message: Message = { id: createId(), role: "user", content: text, createdAt: now };
  if (attachments.length > 0) {
    for (const attachment of attachments) saveAttachment(attachment);
    // Everything but the file itself, which goes to IndexedDB.
    message.attachments = attachments.map(({ id, name, mimeType, size, width, height }) => ({
      id,
      name,
      mimeType,
      size,
      width,
      height,
    }));
  }

  if (existing) {
    updateMessages(conversationId, (messages) => [...messages, message]);
    touch(conversationId);
    void generate(conversationId);
    return conversationId;
  }

  const id = createId();
  setState((state) => ({
    conversations: {
      ...state.conversations,
      [id]: {
        id,
        title: titleFrom(text || (attachments[0]?.name ?? "")),
        createdAt: now,
        updatedAt: now,
        modelId: state.modelId,
      },
    },
    messages: { ...state.messages, [id]: [message] },
  }));
  void generate(id);
  return id;
}

/**
 * Rewrites a user message, keeping its attachments, drops everything after it and generates a new
 * reply.
 */
export function editMessage(conversationId: string, messageId: string, content: string) {
  const text = content.trim();
  const index = indexOfMessage(conversationId, messageId);
  if (index === -1) return;
  const message = getState().messages[conversationId][index];
  if (!text && !message.attachments?.length) return;
  controllers.get(conversationId)?.abort();
  updateMessages(conversationId, (messages) => [
    ...messages.slice(0, index),
    { ...message, content: text },
  ]);
  removeUnusedAttachments();
  touch(conversationId);
  void generate(conversationId);
}

/** Replaces the chat's last reply, if it failed, with a new one from the chat's model. */
export function retry(conversationId: string) {
  const last = getState().messages[conversationId]?.at(-1);
  if (last?.status !== "error" || controllers.has(conversationId)) return;
  updateMessages(conversationId, (messages) => messages.slice(0, -1));
  // It may have created images before it failed.
  removeUnusedAttachments();
  touch(conversationId);
  void generate(conversationId);
}

export function stopGenerating(conversationId: string) {
  controllers.get(conversationId)?.abort();
}

export function setFeedback(conversationId: string, messageId: string, feedback: "up" | "down") {
  patchMessage(conversationId, messageId, (message) => ({
    feedback: message.feedback === feedback ? undefined : feedback,
  }));
}

export function renameConversation(conversationId: string, title: string) {
  const trimmed = title.trim();
  setState((state) => {
    const conversation = state.conversations[conversationId];
    if (!conversation || !trimmed || trimmed === conversation.title) return state;
    return {
      conversations: { ...state.conversations, [conversationId]: { ...conversation, title: trimmed } },
    };
  });
}

export function deleteConversation(conversationId: string) {
  controllers.get(conversationId)?.abort();
  setState((state) => ({
    conversations: omit(state.conversations, conversationId),
    messages: omit(state.messages, conversationId),
  }));
  removeUnusedAttachments();
}

export function deleteAllConversations() {
  for (const controller of controllers.values()) controller.abort();
  setState({ conversations: {}, messages: {} });
  removeUnusedAttachments();
}

/** Deletes the saved files of attachments whose messages are gone. */
export function removeUnusedAttachments() {
  // Before the saved chats load, every file would look unused.
  if (!getState().hydrated) return;
  void deleteAttachmentsExcept(attachmentsInUse);
}

function attachmentsInUse(): Set<string> {
  const used = new Set<string>();
  for (const list of Object.values(getState().messages)) {
    for (const message of list) {
      for (const file of [...(message.attachments ?? []), ...(message.images ?? [])]) {
        used.add(file.id);
      }
    }
  }
  return used;
}

async function generate(conversationId: string) {
  const state = getState();
  const { effort: preferredEffort, webSearch, xSearch, messages } = state;
  const modelId = chatModelId(state, conversationId);
  const reasoning = getModel(modelId)?.reasoning;
  const effort = reasoning && resolveEffort(reasoning, preferredEffort);
  const sent = (messages[conversationId] ?? []).filter(
    (message) => message.content.trim() || message.attachments?.length,
  );

  const reply: Message = {
    id: createId(),
    role: "assistant",
    content: "",
    createdAt: Date.now(),
    model: modelId,
    effort,
    status: "streaming",
  };
  updateMessages(conversationId, (list) => [...list, reply]);

  const controller = new AbortController();
  controllers.set(conversationId, controller);
  try {
    const stream = streamChat({
      chatId: conversationId,
      model: modelId,
      effort,
      webSearch,
      xSearch,
      messages: await Promise.all(sent.map(toChatMessage)),
      signal: controller.signal,
    });
    let images = 0;
    for await (const chunk of stream) {
      if (chunk.type === "image") {
        images += 1;
        const image = await saveCreatedImage(chunk.data, `Zeus image ${images}`);
        patchMessage(conversationId, reply.id, (message) => ({
          images: [...(message.images ?? []), image],
        }));
      } else {
        patchMessage(conversationId, reply.id, (message) => applyChunk(message, chunk));
      }
    }
    patchMessage(conversationId, reply.id, () => ({ status: "done" }));
  } catch (error) {
    if (controller.signal.aborted) {
      // Keep whatever streamed before the stop.
      patchMessage(conversationId, reply.id, () => ({ status: "stopped" }));
    } else {
      const reason = error instanceof Error ? error.message : "Something went wrong.";
      patchMessage(conversationId, reply.id, () => ({ status: "error", error: reason }));
    }
  } finally {
    // Stopped (or failed) while still thinking: it thought until now.
    patchMessage(conversationId, reply.id, (message) =>
      message.reasoning && message.thinkingMs === undefined
        ? { thinkingMs: Date.now() - message.createdAt }
        : {},
    );
    if (controllers.get(conversationId) === controller) controllers.delete(conversationId);
    touch(conversationId);
  }
}

/** A message as /api/chat takes it, with its attachments' files read in. */
async function toChatMessage({ role, content, model, attachments }: Message): Promise<ChatMessage> {
  if (!attachments?.length) return { role, content, model };
  const files = await Promise.all(attachments.map(({ id }) => attachmentData(id)));
  return {
    role,
    content,
    // A file that's gone (the browser's site data was cleared) is left out.
    attachments: attachments.flatMap(({ name }, index) => {
      const data = files[index];
      return data ? [{ name, data }] : [];
    }),
  };
}

/** The changes a streamed piece of the reply makes to it. Images are saved first (see generate). */
function applyChunk(
  message: Message,
  chunk: Exclude<ReplyChunk, { type: "image" }>,
): Partial<Message> {
  switch (chunk.type) {
    case "reasoning":
      return { reasoning: (message.reasoning ?? "") + chunk.text };
    case "sources":
      return { sources: [...(message.sources ?? []), ...chunk.sources] };
    case "text":
      // Some models write a blank line before they search; the answer starts with its first word.
      if (!message.content && !chunk.text.trim()) return {};
      return {
        content: message.content + chunk.text,
        // The answer starting ends the thinking.
        thinkingMs: message.thinkingMs ?? Date.now() - message.createdAt,
      };
    case "end":
      return { usage: chunk.usage, finishReason: chunk.finishReason };
  }
}

function updateMessages(conversationId: string, update: (messages: Message[]) => Message[]) {
  setState((state) => {
    const messages = state.messages[conversationId];
    // The conversation may have been deleted while a reply was streaming.
    if (!messages) return state;
    return { messages: { ...state.messages, [conversationId]: update(messages) } };
  });
}

function patchMessage(
  conversationId: string,
  messageId: string,
  patch: (message: Message) => Partial<Message>,
) {
  updateMessages(conversationId, (messages) =>
    messages.map((message) => (message.id === messageId ? { ...message, ...patch(message) } : message)),
  );
}

/** Marks a conversation as recently active, which moves it to the top of the sidebar. */
function touch(conversationId: string) {
  setState((state) => {
    const conversation = state.conversations[conversationId];
    if (!conversation) return state;
    return {
      conversations: {
        ...state.conversations,
        [conversationId]: { ...conversation, updatedAt: Date.now() },
      },
    };
  });
}

function indexOfMessage(conversationId: string, messageId: string): number {
  return getState().messages[conversationId]?.findIndex((message) => message.id === messageId) ?? -1;
}

/** Title from the first message until titles are generated by a model. */
function titleFrom(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= 40) return line;
  const cut = line.slice(0, 40);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  const copy = { ...record };
  delete copy[key];
  return copy;
}
