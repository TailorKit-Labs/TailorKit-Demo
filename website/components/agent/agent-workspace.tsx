"use client";

import { useId, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChevronDownIcon, PanelsTopLeftIcon, PlusIcon } from "lucide-react";
import type { CrmAgentMessage } from "@/lib/agents/crm-agent";
import { rpc } from "@/lib/orpc";
import type { AgentHistory, AgentChatSummary } from "@/lib/agents/agent-chat-types";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetPopup, SheetTitle } from "@/components/ui/sheet";
import { useSidebar } from "@/components/ui/sidebar";
import { AppMobileNavigation } from "@/components/app/app-mobile-navigation";
import { AppsPanelContext } from "./apps-panel-context";
import { AppsPanel } from "./apps-panel";
import {
  Drawer,
  DrawerContent,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AgentChat } from "./agent-chat";
import { cn } from "@/lib/utils";
import { useViews } from "@/lib/tailorkit-client";

const transport = new DefaultChatTransport<CrmAgentMessage>({ api: "/api/agent" });

export function AgentWorkspace({
  children,
  initialHistory,
}: {
  children: React.ReactNode;
  initialHistory: AgentHistory;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const panelId = useId();
  const canDock = useMediaQuery("xl");
  const useDrawer = useMediaQuery("max-md");
  const [openOverride, setOpen] = useState<boolean | null>(null);
  const open = openOverride ?? canDock;
  const [activeTab, setActiveTab] = useState("agent");
  const { data: views, isPending: appsPending, error: appsError } = useViews({ slot: "panel" });
  const [appOrder, setAppOrder] = useState<string[]>([]);
  const apps = (views ?? [])
    .map((view) => view.app)
    .sort((a, b) => {
      const rank = (id: string) => {
        const index = appOrder.indexOf(id);
        return index < 0 ? Infinity : index;
      };
      return rank(a.id) - rank(b.id);
    });
  const selectedTab = apps.some((app) => app.id === activeTab) ? activeTab : "agent";
  const [input, setInput] = useState("");
  const [chatId, setChatId] = useState<string | null>(initialHistory.latest?.id ?? null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [historyError, setHistoryError] = useState<Error>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const { messages, setMessages, sendMessage, status, stop, error, clearError } =
    useChat<CrmAgentMessage>({
      transport,
      messages: initialHistory.latest?.messages ?? [],
      // Refresh even after cancellation: a tool may already have committed a change.
      onFinish: () => router.refresh(),
      onError: () => router.refresh(),
    });
  const busy = status === "submitted" || status === "streaming";
  const panelContext = useMemo(
    () => ({
      open,
      panelId,
      toggle: () => {
        setOpen((value) => !(value ?? canDock));
        setOpenMobile(false);
        setHistoryOpen(false);
      },
    }),
    [open, canDock, panelId, setOpenMobile],
  );

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) setOpenMobile(false);
    if (!next) setHistoryOpen(false);
  }

  function newChat() {
    if (busy || loadingChat) return;
    setChatId(null);
    setMessages([]);
    setInput("");
    clearError();
    setHistoryError(undefined);
    setHistoryOpen(false);
    setOpen(true);
  }

  async function restoreChat(chat: AgentChatSummary) {
    if (busy || loadingChat) return;
    setLoadingChat(true);
    setHistoryError(undefined);
    try {
      const saved = await rpc.chats.get({ id: chat.id });
      setChatId(saved.id);
      setMessages(saved.messages);
      setInput("");
      clearError();
      setHistoryOpen(false);
      setOpen(true);
    } catch (error) {
      setHistoryError(error instanceof Error ? error : new Error("This chat could not be loaded."));
    } finally {
      setLoadingChat(false);
    }
  }

  async function submit(text: string) {
    if (!text.trim() || busy || loadingChat) return;
    clearError();
    setHistoryError(undefined);
    const id = chatId ?? crypto.randomUUID();
    setChatId(id);
    setInput("");
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const page = pathname.startsWith("/contacts/") ? "/contacts" : pathname;
    await sendMessage(
      { text: text.trim() },
      {
        body: {
          chatId: id,
          page,
          date,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    );
  }

  const currentTitle = messages.length
    ? messages
        .find((message) => message.role === "user")
        ?.parts.filter((part) => part.type === "text")
        .map((part) => part.text)
        .join(" ") || "Chat"
    : "New chat";
  const recentChats = initialHistory.chats;
  const chatTitle = (
    <DropdownMenu open={historyOpen} onOpenChange={setHistoryOpen}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" className="min-w-0 max-w-full" />}
        aria-label="Chat history"
      >
        <span className="truncate">{loadingChat ? "Loading chat…" : currentTitle}</span>
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={newChat} disabled={busy || loadingChat}>
            <PlusIcon />
            New chat
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Recent chats</DropdownMenuLabel>
          {recentChats.map((saved) => (
            <DropdownMenuItem
              key={saved.id}
              disabled={busy || loadingChat}
              onClick={() => {
                void restoreChat(saved);
              }}
            >
              <span className="truncate">{saved.title}</span>
            </DropdownMenuItem>
          ))}
          {!recentChats.length ? (
            <DropdownMenuItem disabled>No recent chats</DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const chat = (
    <AgentChat
      chatTitle={chatTitle}
      messages={messages}
      input={input}
      onInputChange={setInput}
      onSubmit={submit}
      status={status}
      error={historyError ?? error}
      onStop={() => {
        void stop();
        router.refresh();
      }}
      onNewChat={newChat}
      docked={!useDrawer}
    />
  );

  const panel = (
    <AppsPanel
      apps={apps}
      onReorder={(next) => setAppOrder(next.map((app) => app.id))}
      activeTab={selectedTab}
      appsStatus={appsError ? "error" : appsPending ? "loading" : undefined}
      onTabChange={(tab) => {
        setActiveTab(tab);
        setHistoryOpen(false);
      }}
    >
      {chat}
    </AppsPanel>
  );

  return (
    <AppsPanelContext.Provider value={panelContext}>
      <div className="flex min-h-0 min-w-0 flex-1 gap-2 md:p-2">
        <section
          aria-label="Workspace content"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background md:rounded-2xl md:border md:shadow-xs"
        >
          {children}
        </section>
        <aside
          id={canDock ? panelId : undefined}
          aria-label="Agent and apps"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !event.defaultPrevented) {
              event.preventDefault();
              changeOpen(false);
            }
          }}
          className={cn(
            "hidden w-[390px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-popover shadow-xs min-[1280px]:flex",
            openOverride === false && "min-[1280px]:hidden",
          )}
        >
          {/* CSS reserves desktop space before hydration; only the active surface mounts the chat. */}
          {canDock ? panel : null}
        </aside>
      </div>
      {useDrawer ? (
        <div
          aria-label="Mobile tools"
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-xl border bg-popover p-1 shadow-xl"
        >
          <Drawer open={open} onOpenChange={changeOpen}>
            <DrawerTrigger render={<Button variant="ghost" size="sm" />} aria-label="Open apps">
              <PanelsTopLeftIcon data-icon="inline-start" />
              Apps
            </DrawerTrigger>
            <DrawerPopup
              showBar
              className="h-[calc(100dvh-3rem)] overflow-hidden has-data-[slot=drawer-bar]:pt-6"
            >
              <DrawerTitle className="sr-only">Agent and apps</DrawerTitle>
              <DrawerContent
                id={panelId}
                className="min-h-0 min-w-0 flex-1 touch-auto pb-[env(safe-area-inset-bottom)]"
              >
                {panel}
              </DrawerContent>
            </DrawerPopup>
          </Drawer>
          <Separator orientation="vertical" className="h-5" />
          <AppMobileNavigation onOpen={() => changeOpen(false)} />
        </div>
      ) : !canDock ? (
        <Sheet open={open} onOpenChange={changeOpen}>
          <SheetPopup
            id={panelId}
            side="right"
            showCloseButton={false}
            className="w-[390px] max-w-[calc(100vw-3rem)]"
          >
            <SheetTitle className="sr-only">Agent and apps</SheetTitle>
            {panel}
          </SheetPopup>
        </Sheet>
      ) : null}
      <span className={cn("sr-only", !busy && "hidden")} role="status">
        Agent is working
      </span>
    </AppsPanelContext.Provider>
  );
}
