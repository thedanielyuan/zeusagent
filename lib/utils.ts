import { clsx, type ClassValue } from "clsx";
import type { KeyboardEvent } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

/**
 * Random 16-character id. Uses getRandomValues rather than randomUUID, which browsers only
 * expose on secure origins (so the app also works when opened over a LAN IP).
 */
export function createId(): string {
  let id = "";
  for (const byte of crypto.getRandomValues(new Uint8Array(16))) id += ID_ALPHABET[byte & 31];
  return id;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // The async clipboard API is missing on insecure origins; fall back to a hidden textarea.
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

/** "reuters.com" for https://www.reuters.com/world/…, or undefined when `url` isn't a URL. */
export function siteName(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** Enter sends and Shift+Enter adds a line; on touch keyboards Enter always adds a line. */
export function isSubmitKey(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.nativeEvent.isComposing &&
    !window.matchMedia("(pointer: coarse)").matches
  );
}

/** Sizes a textarea to its content; CSS max-height takes over from there. */
export function fitTextareaHeight(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}
