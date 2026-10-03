import { streamChat, type ReplyChunk } from "./chat-api";
import { getModel, resolveEffort } from "./models";
import { useChatStore } from "./store";
import type { Message, ReasoningEffort } from "./types";
import { createId } from "./utils";

const { getState, setState } = useChatStore;

/** Replies currently streaming, by conversation id. */
const controllers = new Map<string, AbortController>();

export function setModel(modelId: string) {
  setState({ modelId });
}

export function setEffort(effort: ReasoningEffort) {
  setState({ effort });
}

export function setWebSearch(webSearch: boolean) {
  setState({ webSearch });
}

/** Sends a message, starting a new conversation when `conversationId` is null. Returns its id. */
export function sendMessage(conversationId: string | null, content: string): string {
  const text = content.trim();
  const now = Date.now();
  const message: Message = { id: createId(), role: "user", content: text, createdAt: now };

  if (conversationId && getState().conversations[conversationId]) {
    if (controllers.has(conversationId)) return conversationId;
    updateMessages(conversationId, (messages) => [...messages, message]);
    touch(conversationId);
    void generate(conversationId);
    return conversationId;
  }

  const id = createId();
  setState((state) => ({
    conversations: {
      ...state.conversations,
      [id]: { id, title: titleFrom(text), createdAt: now, updatedAt: now },
    },
    messages: { ...state.messages, [id]: [message] },
  }));
  void generate(id);
  return id;
}

/** Replaces an assistant reply (and anything after it) with a freshly generated one. */
export function regenerate(conversationId: string, messageId: string) {
  const index = indexOfMessage(conversationId, messageId);
  if (index === -1) return;
  controllers.get(conversationId)?.abort();
  updateMessages(conversationId, (messages) => messages.slice(0, index));
  void generate(conversationId);
}

/** Rewrites a user message, drops everything after it and generates a new reply. */
export function editMessage(conversationId: string, messageId: string, content: string) {
  const text = content.trim();
  const index = indexOfMessage(conversationId, messageId);
  if (!text || index === -1) return;
  controllers.get(conversationId)?.abort();
  updateMessages(conversationId, (messages) => [
    ...messages.slice(0, index),
    { ...messages[index], content: text },
  ]);
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
}

export function deleteAllConversations() {
  for (const controller of controllers.values()) controller.abort();
  setState({ conversations: {}, messages: {} });
}

async function generate(conversationId: string) {
  const { modelId, effort: preferredEffort, webSearch, messages } = getState();
  const reasoning = getModel(modelId)?.reasoning;
  const effort = reasoning && resolveEffort(reasoning, preferredEffort);
  const history = (messages[conversationId] ?? [])
    .filter((message) => message.content.trim())
    .map(({ role, content }) => ({ role, content }));

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
      model: modelId,
      effort,
      webSearch,
      messages: history,
      signal: controller.signal,
    });
    for await (const chunk of stream) {
      patchMessage(conversationId, reply.id, (message) => applyChunk(message, chunk));
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

/** The changes a streamed piece of the reply makes to it. */
function applyChunk(message: Message, chunk: ReplyChunk): Partial<Message> {
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
