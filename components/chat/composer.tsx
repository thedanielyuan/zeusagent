"use client";

import { ArrowUp, AtSign, Globe, Paperclip, Plus, Square } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, MenuContent, MenuItem, MenuSwitch, MenuTrigger } from "@/components/ui/menu";
import { setWebSearch, setXSearch } from "@/lib/actions";
import {
  ACCEPTED_FILES,
  MAX_ATTACHMENTS,
  prepareAttachment,
  type PendingAttachment,
} from "@/lib/attachments";
import { canSearchX } from "@/lib/models";
import { useChatStore } from "@/lib/store";
import { createId, fitTextareaHeight, isSubmitKey } from "@/lib/utils";
import { ComposerAttachments, type DraftAttachment } from "./attachments";
import { EffortSelector, ModelSelector, useChatModel } from "./model-selector";

const INPUT_ID = "composer-input";

/** Taller than this (one 24px line plus padding), the text has wrapped onto a second line. */
const ONE_LINE_HEIGHT = 40;

/** Focuses the message box, except on touch screens where it would pop up the keyboard. */
export function focusComposer() {
  if (window.matchMedia("(pointer: fine)").matches) document.getElementById(INPUT_ID)?.focus();
}

interface Draft {
  text: string;
  attachments: DraftAttachment[];
}

const EMPTY_DRAFT: Draft = { text: "", attachments: [] };

/**
 * Unsent text and files per chat ("new" for the new-chat screen), kept for the browser session.
 * Kept outside React so a file that finishes loading after the user switched chats still lands in
 * the draft it was added to.
 */
const drafts = new Map<string, Draft>();
const draftListeners = new Set<() => void>();

function updateDraft(key: string, update: (draft: Draft) => Draft) {
  const draft = update(drafts.get(key) ?? EMPTY_DRAFT);
  if (draft.text || draft.attachments.length > 0) drafts.set(key, draft);
  else drafts.delete(key);
  for (const listener of draftListeners) listener();
}

function subscribeToDrafts(listener: () => void) {
  draftListeners.add(listener);
  return () => draftListeners.delete(listener);
}

function useDraft(key: string): Draft {
  return useSyncExternalStore(
    subscribeToDrafts,
    () => drafts.get(key) ?? EMPTY_DRAFT,
    () => EMPTY_DRAFT,
  );
}

/** Adds files to a chat's draft, then reads each one (resizing images) in the background. */
function addFiles(key: string, files: File[], onError: (message: string) => void) {
  const room = MAX_ATTACHMENTS - (drafts.get(key)?.attachments.length ?? 0);
  if (files.length > room) onError(`A message can have up to ${MAX_ATTACHMENTS} files.`);
  const added = files.slice(0, Math.max(room, 0)).map((file) => {
    const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const attachment: DraftAttachment = {
      key: createId(),
      name: file.name,
      pdf,
      previewUrl: pdf ? undefined : URL.createObjectURL(file),
    };
    return { file, attachment };
  });
  if (added.length === 0) return;

  updateDraft(key, (draft) => ({
    ...draft,
    attachments: [...draft.attachments, ...added.map(({ attachment }) => attachment)],
  }));
  for (const { file, attachment } of added) {
    prepareAttachment(file).then(
      (ready) =>
        updateDraft(key, (draft) => ({
          ...draft,
          attachments: draft.attachments.map((item) =>
            item.key === attachment.key ? { ...item, ready } : item,
          ),
        })),
      (error: unknown) => {
        removeFile(key, attachment.key);
        onError(error instanceof Error ? error.message : `Couldn't add ${file.name}.`);
      },
    );
  }
}

function removeFile(key: string, attachmentKey: string) {
  updateDraft(key, (draft) => {
    const removed = draft.attachments.find((item) => item.key === attachmentKey);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    return { ...draft, attachments: draft.attachments.filter((item) => item !== removed) };
  });
}

function clearDraft(key: string) {
  for (const { previewUrl } of drafts.get(key)?.attachments ?? []) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }
  updateDraft(key, () => EMPTY_DRAFT);
}

interface ComposerProps {
  /** The open chat, or null on the new-chat screen. */
  conversationId: string | null;
  generating: boolean;
  onSend: (text: string, attachments: PendingAttachment[]) => void;
  onStop: () => void;
}

export function Composer({ conversationId, generating, onSend, onStop }: ComposerProps) {
  const draftKey = conversationId ?? "new";
  const { text, attachments } = useDraft(draftKey);
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const add = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      setError(undefined);
      addFiles(draftKey, files, setError);
    },
    [draftKey],
  );

  // Grow with the text. Once it no longer fits on one line, move the buttons below it (like
  // ChatGPT), and stay that way until the box is cleared so the layout doesn't flicker.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    const textarea = textareaRef.current;
    if (!grid || !textarea) return;
    if (!text) delete grid.dataset.expanded;
    fitTextareaHeight(textarea);
    if (!grid.dataset.expanded && (text.includes("\n") || textarea.scrollHeight > ONE_LINE_HEIGHT)) {
      grid.dataset.expanded = "true";
      fitTextareaHeight(textarea);
    }
  }, [text]);

  // Re-measure when the text's width changes (window resize, sidebar toggle, picking a model
  // with a longer name).
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    let width = textarea.clientWidth;
    const observer = new ResizeObserver(() => {
      if (textarea.clientWidth === width) return;
      width = textarea.clientWidth;
      fitTextareaHeight(textarea);
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(undefined), 6000);
    return () => clearTimeout(timer);
  }, [error]);

  // Files dropped anywhere in the window go in the message. Without this, the browser would open a
  // file dropped outside the box in place of Zeus.
  useEffect(() => {
    let depth = 0;
    const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;
    const onDragEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth += 1;
      setDragging(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDragOver = (event: DragEvent) => {
      if (carriesFiles(event)) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      add([...(event.dataTransfer?.files ?? [])]);
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [add]);

  // Images are resized before they can be sent.
  const ready = attachments.every((attachment) => attachment.ready);
  const canSend = (text.trim().length > 0 || attachments.length > 0) && ready && !generating;

  const submit = () => {
    if (!canSend) return;
    onSend(
      text.trim(),
      attachments.flatMap((attachment) => (attachment.ready ? [attachment.ready] : [])),
    );
    clearDraft(draftKey);
  };

  return (
    // A container, so the composer can switch to two rows when it's narrow (see globals.css).
    <div className="@container/composer">
      {error && (
        <p role="alert" className="px-4 pb-2 text-sm text-red-400">
          {error}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget || event.target === gridRef.current) {
            textareaRef.current?.focus();
          }
        }}
        className="cursor-text rounded-[28px] border border-white/[0.08] bg-surface p-2.5 shadow-lg shadow-black/40 transition-colors focus-within:border-white/[0.14]"
      >
        {attachments.length > 0 && (
          <ComposerAttachments
            attachments={attachments}
            onRemove={(key) => removeFile(draftKey, key)}
          />
        )}

        <div ref={gridRef} className="composer">
          <div className="flex [grid-area:leading]">
            <AddMenu
              conversationId={conversationId}
              onAddFiles={() => fileInputRef.current?.click()}
            />
          </div>

          <textarea
            id={INPUT_ID}
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(event) => {
              const next = event.target.value;
              updateDraft(draftKey, (draft) => ({ ...draft, text: next }));
            }}
            onKeyDown={(event) => {
              if (!isSubmitKey(event)) return;
              event.preventDefault();
              submit();
            }}
            onPaste={(event) => {
              // A screenshot or a copied file: attach it rather than paste its name.
              const files = [...event.clipboardData.files];
              if (files.length === 0) return;
              event.preventDefault();
              add(files);
            }}
            placeholder="Ask anything"
            aria-label="Message Zeus"
            className="block max-h-[max(35dvh,6rem)] w-full resize-none overflow-y-auto bg-transparent px-1.5 py-1.5 text-base leading-6 text-fg caret-accent outline-none [grid-area:primary] placeholder:text-fg-subtle"
          />

          <div className="flex min-w-0 items-center justify-end gap-1 [grid-area:trailing]">
            <EffortSelector conversationId={conversationId} />
            <ModelSelector conversationId={conversationId} />
            {generating ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-black transition-colors hover:bg-accent-hover"
              >
                <Square className="size-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Send message"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-black transition-colors hover:bg-accent-hover disabled:bg-white/10 disabled:text-fg-subtle"
              >
                <ArrowUp className="size-5" strokeWidth={2.25} />
              </button>
            )}
          </div>
        </div>
      </form>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_FILES}
        tabIndex={-1}
        className="hidden"
        onChange={(event) => {
          add([...(event.target.files ?? [])]);
          // So picking the same file again still counts as a change.
          event.target.value = "";
        }}
      />
      {dragging && createPortal(<DropOverlay />, document.body)}
    </div>
  );
}

/**
 * The + button's menu: attach files, and turn the web tools on or off. Web search is on by default,
 * and the model decides when to search or open a page.
 */
interface AddMenuProps {
  conversationId: string | null;
  onAddFiles: () => void;
}

function AddMenu({ conversationId, onAddFiles }: AddMenuProps) {
  const hydrated = useChatStore((state) => state.hydrated);
  const webSearch = useChatStore((state) => state.webSearch);
  const xSearch = useChatStore((state) => state.xSearch);
  const searchesX = canSearchX(useChatModel(conversationId));

  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton
          label="Add"
          className="rounded-full data-[state=open]:bg-hover data-[state=open]:text-fg"
        >
          <Plus />
        </IconButton>
      </MenuTrigger>
      <MenuContent
        side="top"
        align="start"
        // Back to the message box. Radix would focus the + instead, which pops up its tooltip.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          focusComposer();
        }}
      >
        <MenuItem onSelect={onAddFiles}>
          <Paperclip />
          Add photos & files
        </MenuItem>
        {/* Switches are disabled until the saved choice loads, since a change before then would
            overwrite the saved chats. */}
        <MenuSwitch checked={webSearch} onCheckedChange={setWebSearch} disabled={!hydrated}>
          <Globe />
          Web search
        </MenuSwitch>
        {/* Off at first, since xAI bills for each post it finds. It rides on web search. */}
        {searchesX && (
          <MenuSwitch
            checked={webSearch && xSearch}
            onCheckedChange={setXSearch}
            disabled={!hydrated || !webSearch}
          >
            <AtSign />
            <span>
              X search
              <span className="block text-xs text-fg-subtle">Billed per post found</span>
            </span>
          </MenuSwitch>
        )}
      </MenuContent>
    </Menu>
  );
}

/** Shown while files are dragged over the window, which takes them anywhere. */
function DropOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/70 p-4">
      <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-white/25 px-12 py-10 text-center">
        <Paperclip className="mb-1 size-7 text-fg" />
        <p className="text-lg font-medium text-fg">Add files</p>
        <p className="text-sm text-fg-muted">Drop images or PDFs to attach them</p>
      </div>
    </div>
  );
}
