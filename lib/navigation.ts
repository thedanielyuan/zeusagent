import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";

const CHAT_PATH = /^\/c\/([^/]+)\/?$/;

export function chatHref(conversationId: string): string {
  return `/c/${conversationId}`;
}

/** The conversation id in the URL (`/c/:id`), or null on the new-chat page. */
export function useActiveConversationId(): string | null {
  const match = CHAT_PATH.exec(usePathname());
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Moves between chats without a server round trip. Chats live in the browser, so every chat URL
 * renders the same page; Next.js keeps usePathname in sync with native history updates.
 */
export function navigate(href: string, { replace = false } = {}) {
  if (window.location.pathname === href) return;
  if (replace) window.history.replaceState(null, "", href);
  else window.history.pushState(null, "", href);
}

/** False for modified or middle clicks, so links can still open in a new tab. */
export function isPlainLeftClick(event: MouseEvent): boolean {
  return (
    event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
  );
}
