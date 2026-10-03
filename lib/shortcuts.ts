import { useSyncExternalStore } from "react";

export const SHORTCUTS = {
  newChat: "mod+shift+o",
  search: "mod+k",
  toggleSidebar: "mod+shift+s",
} as const;

const MAC_KEYS: Record<string, string> = { ctrl: "⌃", alt: "⌥", shift: "⇧", mod: "⌘", enter: "↵" };
const OTHER_KEYS: Record<string, string> = {
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
  mod: "Ctrl",
  enter: "Enter",
};
const MAC_MODIFIER_ORDER = ["ctrl", "alt", "shift", "mod"];

/** Key caps for a shortcut like "mod+shift+o": ["⇧", "⌘", "O"] on macOS, else ["Ctrl", "Shift", "O"]. */
export function shortcutKeys(shortcut: string, isMac: boolean): string[] {
  const parts = shortcut.split("+");
  if (isMac) {
    const rank = (part: string) => {
      const index = MAC_MODIFIER_ORDER.indexOf(part);
      return index === -1 ? MAC_MODIFIER_ORDER.length : index;
    };
    parts.sort((a, b) => rank(a) - rank(b));
  }
  const names = isMac ? MAC_KEYS : OTHER_KEYS;
  return parts.map((part) => names[part] ?? part.toUpperCase());
}

export function shortcutLabel(shortcut: string, isMac: boolean): string {
  return shortcutKeys(shortcut, isMac).join(isMac ? "" : "+");
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.split("+");
  // "mod" accepts Cmd or Ctrl so shortcuts work on every platform.
  const modPressed = event.metaKey || event.ctrlKey;
  return (
    modPressed === parts.includes("mod") &&
    event.shiftKey === parts.includes("shift") &&
    event.altKey === parts.includes("alt") &&
    event.key.toLowerCase() === parts.at(-1)
  );
}

const subscribeNever = () => () => {};

export function useIsMac(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent),
    () => false,
  );
}
