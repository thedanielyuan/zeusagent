import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import { DEFAULT_MODEL_ID, getModel, isEffort } from "./models";
import type { Conversation, Message, ReasoningEffort } from "./types";

export interface ChatState {
  conversations: Record<string, Conversation>;
  /**
   * Messages by conversation id. Kept apart from the conversation metadata so streaming a reply
   * doesn't re-render the sidebar on every token.
   */
  messages: Record<string, Message[]>;
  /** Model used for new replies. */
  modelId: string;
  /**
   * Reasoning effort for new replies, or null for each model's default. Models without that
   * level use their closest one (see resolveEffort).
   */
  effort: ReasoningEffort | null;
  /** Whether new replies may search the web (the model decides when). */
  webSearch: boolean;
  /** True once the chats saved in this browser have been loaded. */
  hydrated: boolean;
}

type SavedState = Pick<ChatState, "conversations" | "messages" | "modelId" | "effort" | "webSearch">;

export const useChatStore = create<ChatState>()(
  persist(
    (): ChatState => ({
      conversations: {},
      messages: {},
      modelId: DEFAULT_MODEL_ID,
      effort: null,
      webSearch: true,
      hydrated: false,
    }),
    {
      name: "zeus-chats",
      version: 1,
      storage: throttledLocalStorage(),
      // ChatApp rehydrates after mount, so the server and the first client render match.
      skipHydration: true,
      partialize: ({ conversations, messages, modelId, effort, webSearch }): SavedState => ({
        conversations,
        messages,
        modelId,
        effort,
        webSearch,
      }),
      merge: (saved, current) => ({ ...current, ...restore(saved as Partial<SavedState>) }),
      onRehydrateStorage: () => () => useChatStore.setState({ hydrated: true }),
    },
  ),
);

function restore(saved: Partial<SavedState> | undefined): Partial<ChatState> {
  if (!saved) return {};
  const messages: Record<string, Message[]> = {};
  for (const [id, list] of Object.entries(saved.messages ?? {})) {
    // A reply that was streaming when the page closed can't resume.
    messages[id] = list.map((message) =>
      message.status === "streaming" ? { ...message, status: "stopped" } : message,
    );
  }
  return {
    conversations: saved.conversations ?? {},
    messages,
    ...(getModel(saved.modelId) && { modelId: saved.modelId }),
    ...(isEffort(saved.effort) && { effort: saved.effort }),
    ...(typeof saved.webSearch === "boolean" && { webSearch: saved.webSearch }),
  };
}

/**
 * localStorage adapter that writes at most every `interval` ms: a streaming reply updates the
 * store many times per second, and serializing every chat on each token would be wasteful.
 */
function throttledLocalStorage(interval = 500): PersistStorage<SavedState> {
  let pending: { name: string; value: StorageValue<SavedState> } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!pending) return;
    const { name, value } = pending;
    pending = null;
    try {
      localStorage.setItem(name, JSON.stringify(value));
    } catch (error) {
      console.warn("Zeus couldn't save chats to localStorage.", error);
    }
  };

  if (typeof window !== "undefined") {
    // Write the latest tokens before the tab closes or goes to the background.
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  return {
    getItem: (name) => {
      try {
        const raw = localStorage.getItem(name);
        return raw ? (JSON.parse(raw) as StorageValue<SavedState>) : null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      pending = { name, value };
      timer ??= setTimeout(flush, interval);
    },
    removeItem: (name) => {
      pending = null;
      clearTimeout(timer);
      timer = undefined;
      localStorage.removeItem(name);
    },
  };
}
