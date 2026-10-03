"use client";

import { ArrowUp, Plus, Square } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { fitTextareaHeight, isSubmitKey } from "@/lib/utils";
import { EffortSelector, ModelSelector } from "./model-selector";

const INPUT_ID = "composer-input";

/** Unsent text per chat ("new" for the new-chat screen), kept for the browser session. */
const drafts = new Map<string, string>();

/** Taller than this (one 24px line plus padding), the text has wrapped onto a second line. */
const ONE_LINE_HEIGHT = 40;

/** Focuses the message box, except on touch screens where it would pop up the keyboard. */
export function focusComposer() {
  if (window.matchMedia("(pointer: fine)").matches) document.getElementById(INPUT_ID)?.focus();
}

interface ComposerProps {
  /** Which chat's draft to show. */
  draftKey: string;
  generating: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({ draftKey, generating, onSend, onStop }: ComposerProps) {
  const [value, setValue] = useState(() => drafts.get(draftKey) ?? "");
  const [shownKey, setShownKey] = useState(draftKey);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Switching chats swaps in that chat's draft.
  if (shownKey !== draftKey) {
    setShownKey(draftKey);
    setValue(drafts.get(draftKey) ?? "");
  }

  const updateValue = (next: string) => {
    setValue(next);
    if (next) drafts.set(draftKey, next);
    else drafts.delete(draftKey);
  };

  // Grow with the text. Once it no longer fits on one line, move the buttons below it (like
  // ChatGPT), and stay that way until the box is cleared so the layout doesn't flicker.
  useLayoutEffect(() => {
    const form = formRef.current;
    const textarea = textareaRef.current;
    if (!form || !textarea) return;
    if (!value) delete form.dataset.expanded;
    fitTextareaHeight(textarea);
    if (!form.dataset.expanded && (value.includes("\n") || textarea.scrollHeight > ONE_LINE_HEIGHT)) {
      form.dataset.expanded = "true";
      fitTextareaHeight(textarea);
    }
  }, [value]);

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

  const canSend = value.trim().length > 0 && !generating;

  const submit = () => {
    if (!canSend) return;
    onSend(value.trim());
    updateValue("");
  };

  return (
    // A container, so the composer can switch to two rows when it's narrow (see globals.css).
    <div className="@container/composer">
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) textareaRef.current?.focus();
        }}
        className="composer cursor-text rounded-[28px] border border-white/[0.08] bg-surface p-2.5 shadow-lg shadow-black/40 transition-colors focus-within:border-white/[0.14]"
      >
        <div className="flex [grid-area:leading]">
          <IconButton
            label="Add files"
            tooltip="Attachments are coming soon"
            aria-disabled
            className="rounded-full aria-disabled:cursor-not-allowed"
          >
            <Plus />
          </IconButton>
        </div>

        <textarea
          id={INPUT_ID}
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => updateValue(event.target.value)}
          onKeyDown={(event) => {
            if (!isSubmitKey(event)) return;
            event.preventDefault();
            submit();
          }}
          placeholder="Ask anything"
          aria-label="Message Zeus"
          className="block max-h-[max(35dvh,6rem)] w-full resize-none overflow-y-auto bg-transparent px-1.5 py-1.5 text-base leading-6 text-fg caret-accent outline-none [grid-area:primary] placeholder:text-fg-subtle"
        />

        <div className="flex min-w-0 items-center justify-end gap-1 [grid-area:trailing]">
          <EffortSelector />
          <ModelSelector />
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
      </form>
    </div>
  );
}
