"use client";

import { useId, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChevronDownIcon, MousePointer2Icon, PlusIcon } from "lucide-react";
import type { CrmAgentMessage } from "@/lib/agents/crm-agent";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { AppMobileNavigation } from "@/components/app/app-mobile-navigation";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
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

type SavedChat = { id: string; title: string; messages: CrmAgentMessage[] };
const transport = new DefaultChatTransport<CrmAgentMessage>({ api: "/api/agent" });

export function AgentWorkspace({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const agentTriggerId = useId();
  const canDock = useMediaQuery("xl");
  const useDrawer = useMediaQuery("max-md");
  const [open, setOpen] = useState(false);
  const [docked, setDocked] = useState(false);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<SavedChat[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { messages, setMessages, sendMessage, status, stop, error, clearError } =
    useChat<CrmAgentMessage>({
      transport,
      // Refresh even after cancellation: a tool may already have committed a change.
      onFinish: () => router.refresh(),
      onError: () => router.refresh(),
    });
  const busy = status === "submitted" || status === "streaming";
  const showPanel = open && docked && canDock;

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) setOpenMobile(false);
    if (!next) setHistoryOpen(false);
  }

  function archiveCurrentChat() {
    if (!messages.length) return;
    const title =
      messages
        .find((message) => message.role === "user")
        ?.parts.filter((part) => part.type === "text")
        .map((part) => part.text)
        .join(" ") ?? "Chat";
    const id = messages[0].id;
    setHistory((previous) =>
      [{ id, title, messages }, ...previous.filter((chat) => chat.id !== id)].slice(0, 8),
    );
  }

  function newChat() {
    if (busy) return;
    archiveCurrentChat();
    setMessages([]);
    setInput("");
    clearError();
    setHistoryOpen(false);
    setOpen(true);
  }

  function restoreChat(chat: SavedChat) {
    if (busy) return;
    archiveCurrentChat();
    setMessages(chat.messages);
    setInput("");
    clearError();
    setHistoryOpen(false);
    setOpen(true);
  }

  async function submit(text: string) {
    if (!text.trim() || busy) return;
    clearError();
    setInput("");
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const page = pathname.startsWith("/contacts/") ? "/contacts" : pathname;
    await sendMessage(
      { text: text.trim() },
      {
        body: { page, date, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
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
  const recentChats = history.filter((saved) => saved.id !== messages[0]?.id);
  const chatTitle = (
    <DropdownMenu open={historyOpen} onOpenChange={setHistoryOpen}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" className="min-w-0 max-w-full" />}
        aria-label="Chat history"
      >
        <span className="truncate">{currentTitle}</span>
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={newChat} disabled={busy}>
            <PlusIcon />
            New chat
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Recent chats</DropdownMenuLabel>
          {recentChats.map((saved) => (
            <DropdownMenuItem key={saved.id} disabled={busy} onClick={() => restoreChat(saved)}>
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
      error={error}
      onStop={() => {
        void stop();
        router.refresh();
      }}
      onNewChat={newChat}
      onClose={() => changeOpen(false)}
      canDock={canDock}
      docked={showPanel}
      onDockChange={() => {
        setHistoryOpen(false);
        setDocked((value) => !value);
      }}
    />
  );

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 gap-2 md:p-2">
        <section
          aria-label="Workspace content"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background md:rounded-2xl md:border md:shadow-xs"
        >
          {children}
        </section>
        {showPanel ? (
          <aside
            aria-label="Agent"
            className="flex w-[390px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-popover shadow-xs"
          >
            {chat}
          </aside>
        ) : null}
      </div>
      {useDrawer ? (
        <div
          aria-label="Mobile tools"
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-xl border bg-popover p-1 shadow-xl"
        >
          <Drawer open={open} onOpenChange={changeOpen}>
            <DrawerTrigger render={<Button variant="ghost" size="sm" />} aria-label="Agent">
              <MousePointer2Icon data-icon="inline-start" />
              Agent
            </DrawerTrigger>
            <DrawerPopup showBar className="h-[calc(100dvh-3rem)]">
              <DrawerTitle className="sr-only">Agent chat</DrawerTitle>
              <DrawerContent className="min-h-0 flex-1 touch-auto">{chat}</DrawerContent>
            </DrawerPopup>
          </Drawer>
          <Separator orientation="vertical" className="h-5" />
          <AppMobileNavigation onOpen={() => changeOpen(false)} />
        </div>
      ) : (
        <Popover open={open && !showPanel} onOpenChange={changeOpen} triggerId={agentTriggerId}>
          <div className="fixed right-8 bottom-8 z-40" hidden={showPanel}>
            <PopoverTrigger
              id={agentTriggerId}
              render={
                <Button size="icon-xl" className="size-14 rounded-full shadow-lg sm:size-14" />
              }
              aria-label="Agent"
              title="Agent"
            >
              <MousePointer2Icon className="size-6" />
            </PopoverTrigger>
          </div>
          <PopoverPopup
            side="top"
            align="end"
            sideOffset={10}
            aria-label="Agent chat"
            initialFocus={false}
            className="agent-popover h-[min(620px,calc(100dvh-140px))] w-[min(440px,calc(100vw-24px))] rounded-2xl shadow-xl"
          >
            {chat}
          </PopoverPopup>
        </Popover>
      )}
      <span className={cn("sr-only", !busy && "hidden")} role="status">
        Agent is working
      </span>
    </>
  );
}
