"use client";

import { Pencil } from "lucide-react";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { editMessage } from "@/lib/actions";
import type { Message } from "@/lib/types";
import { fitTextareaHeight, isSubmitKey } from "@/lib/utils";
import { CopyButton } from "./copy-button";

interface UserMessageProps {
  conversationId: string;
  message: Message;
}

export const UserMessage = memo(function UserMessage({ conversationId, message }: UserMessageProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <MessageEditor
        initialValue={message.content}
        onCancel={() => setEditing(false)}
        onSubmit={(text) => {
          setEditing(false);
          editMessage(conversationId, message.id, text);
        }}
      />
    );
  }

  return (
    <div className="group flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-3xl bg-surface px-4 py-2.5 leading-7 whitespace-pre-wrap [overflow-wrap:anywhere] sm:max-w-[70%]">
        {message.content}
      </div>
      <div className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <CopyButton text={message.content} />
        <IconButton
          label="Edit message"
          onClick={() => setEditing(true)}
          className="size-8 [&_svg]:size-4"
        >
          <Pencil />
        </IconButton>
      </div>
    </div>
  );
});

interface MessageEditorProps {
  initialValue: string;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}

function MessageEditor({ initialValue, onCancel, onSubmit }: MessageEditorProps) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (textareaRef.current) fitTextareaHeight(textareaRef.current);
  }, [value]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, []);

  const submit = () => {
    if (value.trim()) onSubmit(value);
  };

  return (
    <div className="w-full rounded-3xl bg-surface p-3">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else if (isSubmitKey(event)) {
            event.preventDefault();
            submit();
          }
        }}
        aria-label="Edit message"
        className="block max-h-[40dvh] w-full resize-none overflow-y-auto bg-transparent px-2 py-1 leading-7 text-fg caret-accent outline-none"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-full border border-line px-4 text-sm font-medium transition-colors hover:bg-hover"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          className="h-9 rounded-full bg-accent px-4 text-sm font-medium text-black transition-colors hover:bg-accent-hover disabled:bg-white/10 disabled:text-fg-subtle"
        >
          Send
        </button>
      </div>
    </div>
  );
}
