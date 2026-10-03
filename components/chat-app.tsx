"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatView } from "@/components/chat/chat-view";
import { focusComposer } from "@/components/chat/composer";
import { SearchDialog } from "@/components/search-dialog";
import { SettingsDialog } from "@/components/settings-dialog";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { Sidebar } from "@/components/sidebar/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { chatHref, navigate, useActiveConversationId } from "@/lib/navigation";
import { SHORTCUTS, matchesShortcut } from "@/lib/shortcuts";
import { useChatStore } from "@/lib/store";

const DESKTOP_QUERY = "(min-width: 768px)";

/** The whole chat UI. Rendered by every route; the open chat comes from the URL. */
export function ChatApp() {
  const activeId = useActiveConversationId();
  const activeTitle = useChatStore((state) =>
    activeId ? state.conversations[activeId]?.title : undefined,
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Load the chats saved in this browser. Checked after every render, not just on mount, so a
  // store re-created by hot reloading in development is loaded too.
  useEffect(() => {
    if (!useChatStore.persist.hasHydrated()) void useChatStore.persist.rehydrate();
  });

  // The mobile drawer has no place on desktop layouts.
  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (desktop.matches) setMobileSidebarOpen(false);
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  const newChat = useCallback(() => {
    navigate("/");
    setMobileSidebarOpen(false);
    focusComposer();
  }, []);

  const openConversation = useCallback((conversationId: string) => {
    navigate(chatHref(conversationId));
    setMobileSidebarOpen(false);
    focusComposer();
  }, []);

  const toggleSidebar = useCallback(() => {
    if (window.matchMedia(DESKTOP_QUERY).matches) setSidebarCollapsed((collapsed) => !collapsed);
    else setMobileSidebarOpen((open) => !open);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (matchesShortcut(event, SHORTCUTS.newChat)) {
        event.preventDefault();
        newChat();
      } else if (matchesShortcut(event, SHORTCUTS.search)) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      } else if (matchesShortcut(event, SHORTCUTS.toggleSidebar)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [newChat, toggleSidebar]);

  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={200}>
      {/* Rendered here rather than via metadata, which Next.js streams in after hydration on
          dynamic routes and would overwrite the chat title. React hoists it into <head>. */}
      <title>{activeTitle ? `${activeTitle} | Zeus` : "Zeus"}</title>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar
          activeId={activeId}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onMobileOpenChange={setMobileSidebarOpen}
          onNewChat={newChat}
          onOpenSettings={() => {
            setMobileSidebarOpen(false);
            setSettingsOpen(true);
          }}
          onSearch={() => {
            setMobileSidebarOpen(false);
            setSearchOpen(true);
          }}
          onSelectConversation={openConversation}
          onShowShortcuts={() => setShortcutsOpen(true)}
        />
        <ChatView
          conversationId={activeId}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
          onNewChat={newChat}
        />
      </div>
      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={openConversation}
        onNewChat={newChat}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </TooltipProvider>
  );
}
